-- RLS dan hak akses. Anon hanya membaca; admin (authenticated, signup dimatikan)
-- mengelola data. Penulisan kehadiran publik hanya lewat fungsi set_attendance.

alter table public.categories enable row level security;
alter table public.statuses enable row level security;
alter table public.members enable row level security;
alter table public.category_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.attendance enable row level security;

-- Baca publik untuk semua tabel.
create policy "public read" on public.categories for select to anon, authenticated using (true);
create policy "public read" on public.statuses for select to anon, authenticated using (true);
create policy "public read" on public.members for select to anon, authenticated using (true);
create policy "public read" on public.category_members for select to anon, authenticated using (true);
create policy "public read" on public.sessions for select to anon, authenticated using (true);
create policy "public read" on public.session_members for select to anon, authenticated using (true);
create policy "public read" on public.attendance for select to anon, authenticated using (true);

-- Admin: tulis langsung untuk data master. Kategori dibuat/di-rename/diatur PIN
-- lewat fungsi, tetapi hapus boleh langsung.
create policy "admin delete" on public.categories for delete to authenticated using (true);
create policy "admin write" on public.statuses for all to authenticated using (true) with check (true);
create policy "admin write" on public.members for all to authenticated using (true) with check (true);
create policy "admin write" on public.category_members for all to authenticated using (true) with check (true);
create policy "admin update" on public.sessions for update to authenticated using (true) with check (true);
-- attendance & session_members: tidak ada policy tulis; hanya lewat fungsi security definer.

-- pin_hash tidak boleh terbaca klien mana pun. Supabase memberi SELECT tingkat
-- tabel secara default, jadi cabut dan beri ulang per kolom.
revoke all on public.categories from anon, authenticated;
grant select (id, name, slug, pin_enabled, created_at) on public.categories to anon, authenticated;
grant delete on public.categories to authenticated;
