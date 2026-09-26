-- Sesi berjam: dijadwalkan -> berjalan -> selesai, penutupan otomatis, penjadwalan massal.
-- Lihat openspec/changes/add-scheduled-sessions/design.md (D1–D5).

-- ---------- D1: kolom jam & jendela waktu ----------

alter table public.sessions
  add column start_time time,
  add column end_time time,
  add column grace_hours smallint not null default 0 check (grace_hours in (0, 6, 12, 24)),
  add column opens_at timestamptz,
  add column closes_at timestamptz;

-- Sesi lama boleh tanpa jam; bila berjam, keduanya wajib dan selesai setelah mulai di hari yang sama.
alter table public.sessions add constraint sessions_time_pair check (
  (start_time is null and end_time is null)
  or (start_time is not null and end_time is not null and end_time > start_time)
);

create function public.sessions_set_window() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_time is null then
    new.opens_at := null;
    new.closes_at := null;
  else
    new.opens_at := (new.session_date + new.start_time) at time zone 'Asia/Jakarta';
    new.closes_at := ((new.session_date + new.end_time) at time zone 'Asia/Jakarta')
      + new.grace_hours * interval '1 hour';
  end if;
  return new;
end
$$;

create trigger sessions_set_window
  before insert or update on public.sessions
  for each row execute function public.sessions_set_window();

-- Banyak sesi boleh belum ditutup sekaligus (dijadwalkan); "berjalan" ditentukan waktu (D2).
drop index public.sessions_one_active_key;
create index sessions_open_idx on public.sessions (category_id, opens_at) where closed_at is null;

-- ---------- D2: sesi berjalan ----------

-- Sesi berjalan: sudah dibuka, belum lewat batas, belum ditutup; bila beberapa, yang dibuka terakhir.
create function public.current_session_id(p_category_id uuid) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select s.id from public.sessions s
  where s.category_id = p_category_id
    and s.closed_at is null
    and coalesce(s.opens_at, s.started_at) <= now()
    and (s.closes_at is null or s.closes_at > now())
  order by coalesce(s.opens_at, s.started_at) desc, s.started_at desc, s.id desc
  limit 1
$$;

-- ---------- D3: penutupan ----------

-- Isi status otomatis untuk yang belum mengisi -> snapshot anggota -> tutup. Idempoten.
create function public.close_session(p_session_id uuid, p_closed_at timestamptz) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_auto uuid;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or v_session.closed_at is not null then
    return;
  end if;

  select s.id into v_auto
    from public.categories c
    join public.statuses s on s.id = c.reset_status_id and s.archived_at is null
    where c.id = v_session.category_id;
  if v_auto is not null then
    insert into public.attendance (session_id, member_id, status_id)
      select p_session_id, cm.member_id, v_auto
      from public.category_members cm
      where cm.category_id = v_session.category_id
        and not exists (
          select 1 from public.attendance a where a.session_id = p_session_id and a.member_id = cm.member_id
        );
  end if;

  insert into public.session_members (session_id, member_id)
    select p_session_id, member_id from public.category_members where category_id = v_session.category_id
    on conflict do nothing;
  update public.sessions set closed_at = p_closed_at where id = p_session_id;
end
$$;

-- Tutup sesi kategori yang lewat batas atau tergantikan sesi yang dibuka setelahnya,
-- dengan waktu tutup efektif (bukan waktu fungsi ini berjalan).
create function public.finalize_category(p_category_id uuid) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select s.id, s.closes_at,
      (
        select min(coalesce(n.opens_at, n.started_at))
        from public.sessions n
        where n.category_id = s.category_id
          and coalesce(n.opens_at, n.started_at) <= now()
          and (coalesce(n.opens_at, n.started_at), n.started_at, n.id)
            > (coalesce(s.opens_at, s.started_at), s.started_at, s.id)
      ) as next_open
    from public.sessions s
    where s.category_id = p_category_id
      and s.closed_at is null
      and coalesce(s.opens_at, s.started_at) <= now()
    order by coalesce(s.opens_at, s.started_at)
  loop
    if (r.closes_at is not null and r.closes_at <= now()) or r.next_open is not null then
      perform public.close_session(
        r.id,
        least(coalesce(r.closes_at, 'infinity'::timestamptz), coalesce(r.next_open, 'infinity'::timestamptz))
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

-- Dijalankan pg_cron setiap menit dan dipanggil panel admin sebagai cadangan.
create function public.finalize_due_sessions() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat uuid;
  v_count int := 0;
begin
  for v_cat in
    select distinct s.category_id from public.sessions s
    where s.closed_at is null and coalesce(s.opens_at, s.started_at) <= now()
  loop
    v_count := v_count + public.finalize_category(v_cat);
  end loop;
  return v_count;
end
$$;

-- Akhiri sesi berjalan secara manual.
create or replace function public.end_session(p_category_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.finalize_category(p_category_id);
  v_session := public.current_session_id(p_category_id);
  if v_session is null then
    raise exception 'NO_ACTIVE_SESSION' using errcode = 'P0002';
  end if;
  perform public.close_session(v_session, now());
  return v_session;
end
$$;

-- ---------- Pengisian publik ----------

create or replace function public.set_attendance(
  p_category_id uuid,
  p_member_id uuid,
  p_status_id uuid,
  p_pin text default null
)
returns table (session_id uuid, status_id uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
  v_session uuid;
begin
  select * into v_cat from public.categories where id = p_category_id and is_active;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cat.pin_enabled and p_pin is null then
    raise exception 'PIN_REQUIRED' using errcode = '28000';
  end if;
  if not public.check_category_pin(v_cat, p_pin) then
    raise exception 'PIN_INVALID' using errcode = '28P01';
  end if;

  -- Sesi berjalan ditentukan server dari waktu; sesi lewat batas/tergantikan ditutup dulu.
  perform public.finalize_category(p_category_id);
  v_session := public.current_session_id(p_category_id);
  if v_session is null then
    raise exception 'NO_ACTIVE_SESSION' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.category_members
    where category_id = p_category_id and member_id = p_member_id
  ) then
    raise exception 'NOT_MEMBER' using errcode = '22023';
  end if;

  if p_status_id is not null and not exists (
    select 1 from public.statuses
    where id = p_status_id and category_id = p_category_id and archived_at is null
  ) then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  if p_status_id is null then
    delete from public.attendance a where a.session_id = v_session and a.member_id = p_member_id;
  else
    insert into public.attendance as a (session_id, member_id, status_id, updated_at)
      values (v_session, p_member_id, p_status_id, now())
      on conflict on constraint attendance_pkey
      do update set status_id = excluded.status_id, updated_at = now();
  end if;

  return query select v_session, p_status_id;
end
$$;

-- ---------- D4: RPC admin sesi ----------

create function public.validate_session_fields(p_start time, p_end time, p_grace int, p_note text) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'INVALID_TIME' using errcode = '22023';
  end if;
  if p_grace is null or p_grace not in (0, 6, 12, 24) then
    raise exception 'INVALID_GRACE' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) > 200 then
    raise exception 'NOTE_TOO_LONG' using errcode = '22023';
  end if;
end
$$;

-- p_items = [{"date":"2026-10-05","start":"19:30","end":"21:00","grace":6,"note":"..."}], 1–62 item, atomik.
create function public.schedule_sessions(p_category_id uuid, p_items jsonb) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_start time;
  v_end time;
  v_grace int;
  v_note text;
  v_count int := 0;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ROWS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 62 then
    raise exception 'TOO_MANY_SESSIONS' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_start := nullif(v_item->>'start', '')::time;
    v_end := nullif(v_item->>'end', '')::time;
    v_grace := coalesce((v_item->>'grace')::int, 0);
    v_note := nullif(btrim(coalesce(v_item->>'note', '')), '');
    perform public.validate_session_fields(v_start, v_end, v_grace, v_note);
    insert into public.sessions (category_id, session_date, start_time, end_time, grace_hours, note)
      values (p_category_id, (v_item->>'date')::date, v_start, v_end, v_grace, v_note);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Sesi dijadwalkan/berjalan: tanggal, jam, toleransi, catatan. Sesi selesai: hanya tanggal & catatan.
create function public.update_session(
  p_session_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_grace int,
  p_note text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_admin();
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.finalize_category(v_session.category_id);
  select * into v_session from public.sessions where id = p_session_id;

  if v_session.closed_at is not null then
    if p_start is distinct from v_session.start_time
      or p_end is distinct from v_session.end_time
      or coalesce(p_grace, v_session.grace_hours) <> v_session.grace_hours then
      raise exception 'SESSION_FINISHED' using errcode = '22023';
    end if;
    if v_note is not null and char_length(v_note) > 200 then
      raise exception 'NOTE_TOO_LONG' using errcode = '22023';
    end if;
    update public.sessions set session_date = p_date, note = v_note where id = p_session_id;
    return;
  end if;

  -- Sesi lama tanpa jam boleh tetap tanpa jam.
  if v_session.start_time is null and p_start is null and p_end is null then
    if v_note is not null and char_length(v_note) > 200 then
      raise exception 'NOTE_TOO_LONG' using errcode = '22023';
    end if;
    update public.sessions set session_date = p_date, note = v_note where id = p_session_id;
    return;
  end if;

  perform public.validate_session_fields(p_start, p_end, coalesce(p_grace, 0), v_note);
  update public.sessions set
    session_date = p_date, start_time = p_start, end_time = p_end,
    grace_hours = coalesce(p_grace, 0), note = v_note
  where id = p_session_id;
end
$$;

-- Hanya sesi yang belum dibuka dan belum punya isian.
create function public.delete_session(p_session_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  perform public.assert_admin();
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_session.closed_at is not null
    or v_session.opens_at is null
    or v_session.opens_at <= now()
    or exists (select 1 from public.attendance where session_id = p_session_id) then
    raise exception 'SESSION_NOT_DELETABLE' using errcode = '22023';
  end if;
  delete from public.sessions where id = p_session_id;
end
$$;

-- Diganti schedule_sessions; reset_category adalah pembungkusnya.
drop function public.reset_category(uuid, date, text);
drop function public.start_session(uuid, date, text);

-- Invarian waktu hanya diubah lewat RPC.
drop policy "admin update" on public.sessions;

-- Kategori baru belum memiliki sesi; admin menjadwalkannya.
create or replace function public.create_category(p_name text)
returns table (id uuid, slug text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text;
  v_name text := btrim(p_name);
begin
  perform public.assert_admin();
  if exists (select 1 from public.categories c where lower(btrim(c.name)) = lower(v_name)) then
    raise exception 'CATEGORY_NAME_TAKEN' using errcode = '23505';
  end if;
  v_slug := public.unique_category_slug(v_name);
  insert into public.categories (name, slug) values (v_name, v_slug) returning categories.id into v_id;

  insert into public.statuses (category_id, label, color, sort_order, counts_as_present) values
    (v_id, 'Hadir', '#16a34a', 1, true),
    (v_id, 'Izin',  '#eab308', 2, false),
    (v_id, 'Sakit', '#2563eb', 3, false),
    (v_id, 'Alpa',  '#dc2626', 4, false);

  update public.categories set reset_status_id = (
    select s.id from public.statuses s where s.category_id = v_id and s.label = 'Alpa'
  ) where categories.id = v_id;

  return query select v_id, v_slug;
end
$$;

-- ---------- D5: view ----------

drop view public.category_summary;
create view public.category_summary
with (security_invoker = true)
as
select
  c.id as category_id,
  c.name,
  c.slug,
  c.pin_enabled,
  c.created_at,
  s.id as session_id,
  s.label as session_label,
  count(cm.member_id)::int as total,
  count(cm.member_id) filter (where st.counts_as_present)::int as present,
  count(cm.member_id) filter (where m.gender = 'L')::int as total_l,
  count(cm.member_id) filter (where m.gender = 'L' and st.counts_as_present)::int as present_l,
  count(cm.member_id) filter (where m.gender = 'P')::int as total_p,
  count(cm.member_id) filter (where m.gender = 'P' and st.counts_as_present)::int as present_p,
  c.is_active,
  s.session_date,
  s.note as session_note,
  s.start_time as session_start_time,
  s.end_time as session_end_time,
  s.grace_hours as session_grace_hours,
  s.closes_at as session_closes_at,
  nx.opens_at as next_opens_at,
  nx.label as next_session_label
from public.categories c
left join public.sessions s on s.id = public.current_session_id(c.id)
left join lateral (
  select n.opens_at, n.label from public.sessions n
  where n.category_id = c.id and n.closed_at is null and n.opens_at > now()
  order by n.opens_at
  limit 1
) nx on true
left join public.category_members cm on cm.category_id = c.id
left join public.members m on m.id = cm.member_id
left join public.attendance a on a.session_id = s.id and a.member_id = cm.member_id
left join public.statuses st on st.id = a.status_id
group by c.id, s.id, nx.opens_at, nx.label;

grant select on public.category_summary to anon, authenticated;

-- Laporan & grafik: hanya sesi yang sudah dibuka.
create or replace view public.session_stats
with (security_invoker = true)
as
with session_member as (
  select s.id as session_id, cm.member_id
  from public.sessions s
  join public.category_members cm on cm.category_id = s.category_id
  where s.closed_at is null
  union all
  select sm.session_id, sm.member_id from public.session_members sm
)
select
  s.id as session_id,
  s.category_id,
  s.label,
  s.session_date,
  s.note,
  s.started_at,
  s.closed_at,
  to_char(s.session_date, 'YYYY-MM') as month,
  count(x.member_id)::int as total,
  count(x.member_id) filter (where st.counts_as_present)::int as present
from public.sessions s
left join session_member x on x.session_id = s.id
left join public.attendance a on a.session_id = s.id and a.member_id = x.member_id
left join public.statuses st on st.id = a.status_id
where coalesce(s.opens_at, s.started_at) <= now()
group by s.id;

-- ---------- Hak eksekusi ----------

revoke execute on function public.close_session(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.finalize_category(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_due_sessions() from public, anon;
grant execute on function public.finalize_due_sessions() to authenticated;
