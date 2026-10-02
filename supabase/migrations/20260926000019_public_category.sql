-- Halaman kegiatan publik membaca kegiatan aktif lewat fungsi ini, bukan tabel langsung.
-- RLS categories untuk authenticated hanya memperlihatkan kegiatan dalam cakupan admin, sehingga
-- admin yang membuka halaman publik kegiatan unit lain di browser yang sama melihat
-- "Kegiatan tidak ditemukan". Fungsi ini memberi hasil yang sama untuk anon maupun admin.
create function public.public_category(p_slug text)
returns table (
  id uuid, name text, slug text, pin_enabled boolean, is_active boolean, created_at timestamptz,
  owner_unit_id uuid, scope_all boolean, criteria_gender text, criteria_min_age int, criteria_max_age int,
  criteria_marital text
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.slug, c.pin_enabled, c.is_active, c.created_at, c.owner_unit_id, c.scope_all,
    c.criteria_gender, c.criteria_min_age, c.criteria_max_age, c.criteria_marital
  from public.categories c
  where c.slug = p_slug and c.is_active
$$;
grant execute on function public.public_category(text) to anon, authenticated;
