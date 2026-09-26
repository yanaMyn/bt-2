-- Kategori aktif/nonaktif. Kategori nonaktif disembunyikan dari publik di server. Lihat design.md D5b.

alter table public.categories add column is_active boolean not null default true;
grant select (is_active) on public.categories to anon, authenticated;

-- Anon hanya melihat kategori aktif; admin melihat semua.
drop policy "public read" on public.categories;
create policy "public read active" on public.categories for select to anon using (is_active);
create policy "admin read" on public.categories for select to authenticated using (true);

-- Kolom baru hanya boleh ditambahkan di akhir pada create or replace view.
create or replace view public.category_summary
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
  c.is_active
from public.categories c
join public.sessions s on s.category_id = c.id and s.closed_at is null
left join public.category_members cm on cm.category_id = c.id
left join public.members m on m.id = cm.member_id
left join public.attendance a on a.session_id = s.id and a.member_id = cm.member_id
left join public.statuses st on st.id = a.status_id
group by c.id, s.id;

create function public.set_category_active(p_category_id uuid, p_active boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.categories set is_active = p_active where id = p_category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
end
$$;

-- Fungsi publik: kategori nonaktif diperlakukan seperti tidak ada.
create or replace function public.verify_category_pin(p_category_id uuid, p_pin text) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
begin
  select * into v_cat from public.categories where id = p_category_id and is_active;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.check_category_pin(v_cat, p_pin);
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

  -- Sesi aktif selalu ditentukan server, sehingga sesi tertutup tidak bisa diubah.
  select s.id into v_session from public.sessions s
    where s.category_id = p_category_id and s.closed_at is null;

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
