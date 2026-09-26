-- Permintaan pindah beserta data jamaahnya. Admin kelompok tujuan belum bisa membaca jamaah
-- dari kelompok lain lewat RLS members, jadi data yang dibutuhkan untuk memutuskan diberikan di sini:
-- nama, L/P, tanggal lahir, status nikah, kelompok asal/tujuan, dan siapa yang melepas/memutuskan.
create function public.list_transfers()
returns table (
  id uuid, member_id uuid, from_kelompok uuid, to_kelompok uuid, status text,
  requested_at timestamptz, decided_at timestamptz,
  member_name text, member_gender text, member_birth_date date, member_marital text,
  requested_by_name text, decided_by_name text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select t.id, t.member_id, t.from_kelompok, t.to_kelompok, t.status, t.requested_at, t.decided_at,
      m.name, m.gender, m.birth_date, m.marital_status,
      rp.display_name, dp.display_name
    from public.member_transfers t
    join public.members m on m.id = t.member_id
    left join public.admin_profiles rp on rp.user_id = t.requested_by
    left join public.admin_profiles dp on dp.user_id = t.decided_by
    where public.unit_in_scope(t.from_kelompok) or public.unit_in_scope(t.to_kelompok)
    order by t.requested_at desc;
end
$$;
revoke execute on function public.list_transfers() from public, anon;
grant execute on function public.list_transfers() to authenticated;
