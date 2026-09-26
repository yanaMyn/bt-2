-- Ringkasan per sesi untuk grafik perbandingan antar kategori (design.md D11b).
-- Anggota sesi: snapshot session_members untuk sesi tertutup, keanggotaan saat ini untuk sesi aktif (D3).

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
  s.started_at,
  s.closed_at,
  to_char(s.started_at at time zone 'Asia/Jakarta', 'YYYY-MM') as month,
  count(x.member_id)::int as total,
  count(x.member_id) filter (where st.counts_as_present)::int as present
from public.sessions s
left join session_member x on x.session_id = s.id
left join public.attendance a on a.session_id = s.id and a.member_id = x.member_id
left join public.statuses st on st.id = a.status_id
group by s.id;

grant select on public.session_stats to anon, authenticated;
