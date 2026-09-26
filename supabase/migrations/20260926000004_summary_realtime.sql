-- Ringkasan sesi aktif per kategori untuk beranda (D7) dan realtime (D8).

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
  count(cm.member_id) filter (where m.gender = 'P' and st.counts_as_present)::int as present_p
from public.categories c
join public.sessions s on s.category_id = c.id and s.closed_at is null
left join public.category_members cm on cm.category_id = c.id
left join public.members m on m.id = cm.member_id
left join public.attendance a on a.session_id = s.id and a.member_id = cm.member_id
left join public.statuses st on st.id = a.status_id
group by c.id, s.id;

grant select on public.category_summary to anon, authenticated;

alter publication supabase_realtime add table public.attendance, public.sessions;
