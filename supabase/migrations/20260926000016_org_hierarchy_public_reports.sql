-- Data publik lewat RPC (tanpa data pribadi), ringkasan kegiatan admin, statistik & riwayat jamaah.
-- Lihat openspec/changes/add-org-hierarchy/design.md D7–D8.

-- Peserta sebuah sesi: snapshot bila sudah ditutup, dihitung bila belum.
create function public.session_participants(p_session_id uuid)
returns table (member_id uuid, kelompok_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select sm.member_id, sm.kelompok_id
  from public.sessions s join public.session_members sm on sm.session_id = s.id
  where s.id = p_session_id and s.closed_at is not null
  union all
  select p.member_id, p.kelompok_id
  from public.sessions s, public.activity_participants(s.category_id, s.session_date) p
  where s.id = p_session_id and s.closed_at is null
$$;
revoke execute on function public.session_participants(uuid) from public, anon;
grant execute on function public.session_participants(uuid) to authenticated;

-- ---------- Publik ----------

create function public.public_structure()
returns table (id uuid, level text, parent_id uuid, name text, slug text)
language sql stable security definer
set search_path = ''
as $$
  select id, level, parent_id, name, slug from public.org_units order by level, name
$$;

-- Kegiatan aktif yang mengikutkan kelompok (milik kelompok itu, desanya, atau Daerah) beserta
-- sesi berjalan/berikutnya dan hadir/total untuk peserta dari kelompok itu.
create function public.public_kelompok_activities(p_kelompok uuid)
returns table (
  category_id uuid, name text, slug text, pin_enabled boolean, owner_level text, owner_name text,
  session_id uuid, session_label text, session_note text, session_start_time time, session_end_time time,
  session_closes_at timestamptz, next_opens_at timestamptz, next_session_label text,
  present int, total int
)
language sql stable security definer
set search_path = ''
as $$
  with k as (select id, parent_id from public.org_units where id = p_kelompok and level = 'kelompok'),
  acts as (
    select c.*, o.level as owner_level, o.name as owner_name
    from public.categories c
    join public.org_units o on o.id = c.owner_unit_id
    cross join k
    where c.is_active and (
      c.owner_unit_id = k.id
      or (o.level = 'desa' and c.owner_unit_id = k.parent_id and (
        c.scope_all or exists (select 1 from public.activity_units au where au.category_id = c.id and au.unit_id = k.id)))
      or (o.level = 'daerah' and (
        c.scope_all or exists (select 1 from public.activity_units au where au.category_id = c.id and au.unit_id = k.parent_id)))
    )
  )
  select a.id, a.name, a.slug, a.pin_enabled, a.owner_level, a.owner_name,
    s.id, s.label, s.note, s.start_time, s.end_time, s.closes_at, nx.opens_at, nx.label,
    coalesce(cnt.present, 0), coalesce(cnt.total, 0)
  from acts a
  left join public.sessions s on s.id = public.current_session_id(a.id)
  left join lateral (
    select n.opens_at, n.label from public.sessions n
    where n.category_id = a.id and n.closed_at is null and n.opens_at > now()
    order by n.opens_at limit 1
  ) nx on true
  left join lateral (
    select count(*)::int as total,
           count(*) filter (where st.counts_as_present)::int as present
    from public.activity_participants(a.id, s.session_date) p
    left join public.attendance at on at.session_id = s.id and at.member_id = p.member_id
    left join public.statuses st on st.id = at.status_id
    where s.id is not null and p.kelompok_id = p_kelompok
  ) cnt on true
$$;

-- Peserta sesi berjalan tanpa data pribadi (nama, L/P, kelompok) untuk halaman kegiatan publik.
create function public.public_activity_participants(p_category_id uuid)
returns table (member_id uuid, name text, gender text, kelompok_id uuid, kelompok_name text)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.name, m.gender, k.id, k.name
  from public.categories c
  join public.sessions s on s.id = public.current_session_id(c.id)
  cross join lateral public.activity_participants(c.id, s.session_date) p
  join public.members m on m.id = p.member_id
  join public.org_units k on k.id = p.kelompok_id
  where c.id = p_category_id and c.is_active
  order by m.name
$$;

-- ---------- Admin: ringkasan kegiatan dalam cakupan ----------

create view public.activity_summary
with (security_invoker = true)
as
select
  c.id as category_id, c.name, c.slug, c.pin_enabled, c.is_active, c.owner_unit_id,
  o.level as owner_level, o.name as owner_name,
  c.scope_all, c.criteria_gender, c.criteria_min_age, c.criteria_max_age, c.criteria_marital,
  s.id as session_id, s.label as session_label, s.start_time as session_start_time,
  s.end_time as session_end_time, s.closes_at as session_closes_at,
  nx.opens_at as next_opens_at, nx.label as next_session_label,
  coalesce(cnt.present, 0) as present, coalesce(cnt.total, 0) as total
from public.categories c
join public.org_units o on o.id = c.owner_unit_id
left join public.sessions s on s.id = public.current_session_id(c.id)
left join lateral (
  select n.opens_at, n.label from public.sessions n
  where n.category_id = c.id and n.closed_at is null and n.opens_at > now()
  order by n.opens_at limit 1
) nx on true
left join lateral (
  select count(*)::int as total, count(*) filter (where st.counts_as_present)::int as present
  from public.activity_participants(c.id, s.session_date) p
  left join public.attendance a on a.session_id = s.id and a.member_id = p.member_id
  left join public.statuses st on st.id = a.status_id
  where s.id is not null
) cnt on true;
grant select on public.activity_summary to authenticated;

-- ---------- Statistik sesi (grafik) ----------

create view public.session_stats
with (security_invoker = true)
as
select
  s.id as session_id,
  s.category_id,
  c.owner_unit_id,
  s.label,
  s.session_date,
  s.note,
  s.started_at,
  s.closed_at,
  to_char(s.session_date, 'YYYY-MM') as month,
  count(p.member_id)::int as total,
  count(p.member_id) filter (where st.counts_as_present)::int as present
from public.sessions s
join public.categories c on c.id = s.category_id
cross join lateral public.session_participants(s.id) p
left join public.attendance a on a.session_id = s.id and a.member_id = p.member_id
left join public.statuses st on st.id = a.status_id
where coalesce(s.opens_at, s.started_at) <= now()
group by s.id, c.owner_unit_id;
grant select on public.session_stats to authenticated;

-- ---------- Laporan ----------

-- Jamaah yang pernah/sedang menjadi peserta kegiatan (nama untuk laporan), dengan kelompok asal per sesi.
create function public.activity_report_participants(p_category_id uuid)
returns table (session_id uuid, member_id uuid, kelompok_id uuid, name text, gender text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if not exists (
    select 1 from public.categories c where c.id = p_category_id and public.unit_in_scope(c.owner_unit_id)
  ) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return query
    select s.id, p.member_id, p.kelompok_id, m.name, m.gender
    from public.sessions s
    cross join lateral public.session_participants(s.id) p
    join public.members m on m.id = p.member_id
    where s.category_id = p_category_id and coalesce(s.opens_at, s.started_at) <= now();
end
$$;

-- Riwayat kehadiran seorang jamaah lintas kegiatan & level (admin dalam cakupan jamaah).
create function public.member_history(p_member uuid, p_from date, p_to date)
returns table (
  session_id uuid, session_date date, session_label text, start_time time,
  category_id uuid, category_name text, owner_level text, owner_name text,
  kelompok_id uuid, kelompok_name text,
  status_id uuid, status_label text, status_color text, counts_as_present boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if not exists (select 1 from public.members m where m.id = p_member and public.unit_in_scope(m.kelompok_id)) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return query
    select s.id, s.session_date, s.label, s.start_time, c.id, c.name, o.level, o.name,
      p.kelompok_id, k.name, st.id, st.label, st.color, coalesce(st.counts_as_present, false)
    from public.sessions s
    join public.categories c on c.id = s.category_id
    join public.org_units o on o.id = c.owner_unit_id
    cross join lateral public.session_participants(s.id) p
    join public.org_units k on k.id = p.kelompok_id
    left join public.attendance a on a.session_id = s.id and a.member_id = p.member_id
    left join public.statuses st on st.id = a.status_id
    where p.member_id = p_member
      and s.session_date between p_from and p_to
      and coalesce(s.opens_at, s.started_at) <= now()
    order by s.session_date, s.start_time nulls first;
end
$$;
