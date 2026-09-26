-- "Akhiri sesi" dan "Buat sesi baru" sebagai aksi terpisah; kategori boleh tanpa sesi aktif.
-- Lihat design.md D11e.

-- Akhiri sesi aktif: isi status otomatis untuk yang belum mengisi -> snapshot -> tutup.
create function public.end_session(p_category_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_auto uuid;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  select id into v_old from public.sessions
    where category_id = p_category_id and closed_at is null
    for update;
  if not found then
    raise exception 'NO_ACTIVE_SESSION' using errcode = 'P0002';
  end if;

  select s.id into v_auto
    from public.categories c
    join public.statuses s on s.id = c.reset_status_id and s.archived_at is null
    where c.id = p_category_id;
  if v_auto is not null then
    insert into public.attendance (session_id, member_id, status_id)
      select v_old, cm.member_id, v_auto
      from public.category_members cm
      where cm.category_id = p_category_id
        and not exists (
          select 1 from public.attendance a where a.session_id = v_old and a.member_id = cm.member_id
        );
  end if;

  insert into public.session_members (session_id, member_id)
    select v_old, member_id from public.category_members where category_id = p_category_id;
  update public.sessions set closed_at = now() where id = v_old;
  return v_old;
end
$$;

-- Buat sesi baru: hanya bila tidak ada sesi aktif.
create function public.start_session(p_category_id uuid, p_date date default null, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_new uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_admin();
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'NOTE_TOO_LONG' using errcode = '22023';
  end if;
  -- Kunci kategori agar dua permintaan bersamaan tidak sama-sama lolos cek.
  perform 1 from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.sessions where category_id = p_category_id and closed_at is null) then
    raise exception 'SESSION_ALREADY_ACTIVE' using errcode = '23505';
  end if;
  insert into public.sessions (category_id, session_date, note)
    values (p_category_id, coalesce(p_date, public.today_jakarta()), v_note)
    returning id into v_new;
  return v_new;
end
$$;

-- Pembungkus lama (akhiri + buat) untuk seed dan test; tidak dipakai UI.
create or replace function public.reset_category(p_category_id uuid, p_date date default null, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.end_session(p_category_id);
  return public.start_session(p_category_id, p_date, p_note);
end
$$;

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

  -- Sesi aktif selalu ditentukan server, sehingga sesi tertutup tidak bisa diubah.
  select s.id into v_session from public.sessions s
    where s.category_id = p_category_id and s.closed_at is null;
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

-- Kategori tanpa sesi aktif tetap tampil di ringkasan (kolom sesi null).
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
  s.note as session_note
from public.categories c
left join public.sessions s on s.category_id = c.id and s.closed_at is null
left join public.category_members cm on cm.category_id = c.id
left join public.members m on m.id = cm.member_id
left join public.attendance a on a.session_id = s.id and a.member_id = cm.member_id
left join public.statuses st on st.id = a.status_id
group by c.id, s.id;

grant select on public.category_summary to anon, authenticated;
