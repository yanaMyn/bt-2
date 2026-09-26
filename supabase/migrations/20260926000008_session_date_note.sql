-- Tanggal sesi (dipilih dari kalender) + catatan; label dibentuk otomatis dari tanggal. Lihat design.md D11c.

-- "Sabtu, 26 September 2026"
create function public.format_session_date(d date) returns text
language sql immutable
set search_path = ''
as $$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from d)::int + 1]
         || ', ' || extract(day from d)::int
         || ' ' || (array['Januari','Februari','Maret','April','Mei','Juni','Juli',
                          'Agustus','September','Oktober','November','Desember'])[extract(month from d)::int]
         || ' ' || extract(year from d)::int
$$;

create function public.today_jakarta() returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

alter table public.sessions add column session_date date;
alter table public.sessions add column note text;

-- Data lama: tanggal dari waktu mulai (WIB); label bebas yang bukan label bawaan dipindah ke catatan.
update public.sessions set
  session_date = (started_at at time zone 'Asia/Jakarta')::date,
  note = case
    when btrim(label) = public.default_session_label(started_at) then null
    else left(btrim(label), 200)
  end;

alter table public.sessions alter column session_date set not null;
alter table public.sessions alter column session_date set default public.today_jakarta();
alter table public.sessions
  add constraint sessions_note_length check (note is null or char_length(note) <= 200);

-- label menjadi kolom generated; view yang bergantung padanya dibuat ulang.
drop view public.category_summary;
drop view public.session_stats;
alter table public.sessions drop column label;
alter table public.sessions
  add column label text generated always as (public.format_session_date(session_date)) stored;

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
join public.sessions s on s.category_id = c.id and s.closed_at is null
left join public.category_members cm on cm.category_id = c.id
left join public.members m on m.id = cm.member_id
left join public.attendance a on a.session_id = s.id and a.member_id = cm.member_id
left join public.statuses st on st.id = a.status_id
group by c.id, s.id;

create view public.session_stats
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
group by s.id;

grant select on public.category_summary to anon, authenticated;
grant select on public.session_stats to anon, authenticated;

-- Kategori baru: sesi aktif bertanggal hari ini.
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

  insert into public.sessions (category_id, session_date) values (v_id, public.today_jakarta());

  return query select v_id, v_slug;
end
$$;

-- Reset: snapshot anggota -> tutup sesi aktif -> buka sesi baru bertanggal p_date (atomik).
drop function public.reset_category(uuid, text);
create function public.reset_category(p_category_id uuid, p_date date default null, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_new uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_admin();
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'NOTE_TOO_LONG' using errcode = '22023';
  end if;
  select id into v_old from public.sessions
    where category_id = p_category_id and closed_at is null
    for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.session_members (session_id, member_id)
    select v_old, member_id from public.category_members where category_id = p_category_id;
  update public.sessions set closed_at = now() where id = v_old;
  insert into public.sessions (category_id, session_date, note)
    values (p_category_id, coalesce(p_date, public.today_jakarta()), v_note)
    returning id into v_new;
  return v_new;
end
$$;

drop function public.default_session_label(timestamptz);
