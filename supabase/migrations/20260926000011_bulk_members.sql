-- Aksi massal anggota (admin). Array id diproses dalam satu transaksi.

create function public.remove_members_from_category(p_category_id uuid, p_member_ids uuid[]) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform public.assert_admin();
  delete from public.category_members
    where category_id = p_category_id and member_id = any (p_member_ids);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Menghapus orang beserta keanggotaan dan catatan kehadirannya (cascade).
create function public.delete_members(p_member_ids uuid[]) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform public.assert_admin();
  delete from public.members where id = any (p_member_ids);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Berapa orang (dari daftar) yang memiliki catatan kehadiran, dan total catatannya.
create function public.members_with_history(p_member_ids uuid[])
returns table (people integer, records integer)
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select count(distinct a.member_id)::int, count(*)::int
    from public.attendance a
    where a.member_id = any (p_member_ids);
end
$$;
