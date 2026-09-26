# Design

## Context

Lihat proposal.md untuk motivasi. Kondisi sekarang (migrasi 0001–0013):

- `categories` (kegiatan) dengan `statuses`, `sessions` berjam, `attendance`, PIN, aktif/nonaktif, dan status otomatis; `members` global dan keanggotaan manual `category_members`; `session_members` sebagai snapshot peserta saat sesi ditutup (`close_session`).
- Hak akses: RLS "public read" untuk anon dan "admin write" untuk **semua** `authenticated`; `is_admin()` = sudah login. Pembuatan akun hanya lewat dashboard Supabase.
- `set_attendance`, `close_session`, `category_summary`, `session_stats`, dan `loadReportData` semuanya bergantung pada `category_members`.
- Klien: halaman publik `/` (daftar kategori) dan `/k/:slug`; panel admin datar tanpa peran.

Perubahan ini mengganti keanggotaan manual dengan peserta terhitung, menambah struktur organisasi dan peran, serta membatasi RLS per unit. Data lama dihapus (keputusan pengguna), jadi tidak ada migrasi data.

## Goals / Non-Goals

**Goals:**
- Satu sumber kebenaran peserta: fungsi SQL yang dipakai pengisian, penutupan sesi, ringkasan, dan laporan.
- Wewenang per unit ditegakkan di database (RLS + pemeriksaan RPC), bukan hanya disembunyikan di UI.
- Data pribadi jamaah (tanggal lahir, status nikah) tidak terbaca publik.
- Fitur sesi, status, PIN, dan laporan yang ada tetap bekerja per kegiatan.

**Non-Goals:**
- Banyak Daerah, satu akun untuk beberapa unit, riwayat status nikah, notifikasi, pemulihan password lewat email.

## Decisions

### D1. Model data

```
org_units(id, level 'daerah'|'desa'|'kelompok', parent_id, name, slug unique, created_at)
   -- unique index parsial: tepat satu 'daerah'; trigger: desa->parent daerah, kelompok->parent desa,
   -- parent tidak bisa diubah; nama unik per parent (lower(btrim(name)))
admin_profiles(user_id pk -> auth.users, username unique, display_name, unit_id -> org_units,
   is_active, must_change_password, created_by, created_at)
members + kelompok_id -> org_units (level kelompok), birth_date date, marital_status
   'belum'|'menikah'|'janda_duda' (default 'belum'), inactive_since date, inactive_reason
   'meninggal'|'pindah_luar'|'lainnya'
member_transfers(id, member_id, from_kelompok, to_kelompok, status 'pending'|'accepted'|
   'rejected'|'cancelled', requested_by, requested_at, decided_by, decided_at)
   -- unique parsial: satu 'pending' per member
categories + owner_unit_id -> org_units, scope_all bool default true, criteria_gender 'L'|'P'|null,
   criteria_min_age int, criteria_max_age int, criteria_marital 'belum'|'pernah'|null
   -- nama unik per owner_unit (indeks global lama diganti)
activity_units(category_id, unit_id)       -- wilayah terpilih bila scope_all = false
criteria_templates(id, name, gender, min_age, max_age, marital, sort_order)
session_members + kelompok_id              -- kelompok asal saat sesi ditutup
category_members                           -- DIHAPUS
```

Nama tabel `categories` dipertahankan (UI: "Kegiatan") agar fungsi sesi/status/PIN yang sudah teruji tidak ditulis ulang.
*Alternatif:* rename ke `activities` — menyentuh semua migrasi & kode tanpa manfaat perilaku.

### D2. Peserta terhitung: `activity_participants(p_category_id, p_on date)`
Fungsi `stable security definer` mengembalikan `(member_id, kelompok_id)` untuk jamaah yang:
- aktif pada `p_on` (`inactive_since is null or inactive_since > p_on`);
- kelompoknya dalam wilayah: owner kelompok → `kelompok_id = owner`; owner desa → kelompok berinduk owner dan (`scope_all` atau kelompok ada di `activity_units`); owner daerah → desa induk kelompok (`scope_all` atau ada di `activity_units`);
- memenuhi kriteria: gender; umur `extract(year from age(p_on, birth_date))` dalam [min, max] (bila ada batas umur, `birth_date` wajib ada); marital `'belum'` → `belum`, `'pernah'` → `menikah`/`janda_duda`.

Dipakai oleh `set_attendance` (tolak `NOT_PARTICIPANT`), `close_session` (status otomatis + snapshot dengan `kelompok_id`), ringkasan publik, `session_stats`, dan laporan untuk sesi yang belum ditutup. `p_on` = `session_date` sesi.

### D3. Wewenang: helper SQL + RLS per unit
- `current_admin()` → baris `admin_profiles` aktif milik `auth.uid()` (atau null). `is_admin()` diubah menjadi "punya profil aktif", sehingga user Auth tanpa profil **bukan** admin.
- `unit_in_scope(u)`: `u` adalah unit admin atau turunannya. `manages_unit(u)`: `u` = unit admin. `can_admin_unit_admins(u)`: Daerah→desa mana pun; Desa→kelompok anaknya.
- Policy:
  - `org_units`: baca publik; tulis Daerah (desa & kelompok), Desa (kelompok anaknya).
  - `members`: **anon tanpa akses tabel** (daftar publik lewat RPC); admin baca bila `unit_in_scope(kelompok_id)`; tulis hanya admin kelompok dengan `kelompok_id = unit` admin; trigger melarang mengubah `kelompok_id` di luar RPC perpindahan.
  - `categories`: baca publik (aktif) seperti sekarang + admin dalam cakupan; ubah/hapus bila `manages_unit(owner_unit_id)`.
  - `statuses`, `activity_units`: tulis bila pemilik kegiatan = unit admin.
  - `criteria_templates`: baca admin, tulis Daerah.
  - `admin_profiles`: baca profil sendiri dan profil unit yang boleh ia kelola; tulis hanya lewat Edge Function (service role) dan RPC `password_changed()` untuk profil sendiri.
- RPC admin lama (`schedule_sessions`, `update_session`, `delete_session`, `end_session`, `set_category_pin`, `set_category_active`, `set_reset_status`, `delete_status`, `rename_category`) mengganti `assert_admin()` dengan `assert_manages_category(cat)`.

### D4. Login nama pengguna & Edge Function `admin-accounts`
- Akun dibuat dengan email sintetis `<username>@users.absensi.local` dan `email_confirm: true`, sehingga tidak ada email yang dikirim. Form login: input tanpa `@` → ditambah domain sintetis; dengan `@` → dipakai apa adanya (akun root lama).
- Edge Function Deno `admin-accounts` (aksi `create`, `reset_password`, `set_active`): memverifikasi JWT pemanggil, memuat profilnya, memanggil RPC `can_admin_unit_admins(target_unit)` sebagai pemanggil, lalu memakai service role (`SUPABASE_SERVICE_ROLE_KEY`, tersedia otomatis di Edge Functions) untuk `auth.admin.createUser` / `updateUserById` (password, `ban_duration` untuk nonaktif) dan menulis `admin_profiles`. Validasi masukan (pola username, panjang password, aksi) ditaruh di `logic.ts` murni yang diuji Vitest dan diimpor function.
- Dideploy lewat editor Edge Functions di dashboard (tanpa CLI); README berisi langkahnya.
- Wajib ganti password: klien memeriksa `must_change_password` dan mengarahkan ke `/admin/ganti-password`; setelah `auth.updateUser`, memanggil `password_changed()`.
- Akun nonaktif: ban di Auth + `is_active = false`; RLS memeriksa `is_active` sehingga token yang masih berlaku pun ditolak.
*Alternatif:* undangan email — pengirim email bawaan Supabase dibatasi dan admin tidak wajib punya email; nomor HP — SMS berbayar.

### D5. Perpindahan jamaah
RPC `request_transfer(member, to_kelompok)` (admin kelompok asal), `cancel_transfer(id)` (admin asal), `decide_transfer(id, accept)` (admin tujuan). Menerima: `members.kelompok_id` diubah di dalam fungsi (trigger mengizinkan lewat flag sesi `app.transfer`), status `accepted`. Jamaah dengan permintaan `pending` tidak bisa dilepas lagi atau dinonaktifkan. Karena peserta sesi berjalan dihitung langsung, jamaah langsung pindah daftar; snapshot sesi yang ditutup mencatat kelompok saat ditutup. Tambahan setelah uji browser: `list_transfers()` (migrasi 0017, security definer, cakupan sama dengan RLS `member_transfers`) memberi kelompok tujuan data jamaah yang belum bisa ia baca lewat RLS `members`; migrasi 0018 menambah `request_note` dan `decision_note` (opsional, ≤500, kosong = null; alasan hanya disimpan saat ditolak) dengan parameter `p_note` pada `request_transfer`/`decide_transfer`.

### D6. Kegiatan, wilayah, templat
- RPC `create_activity(owner_unit, name, criteria, scope_all, units[])` membuat kegiatan + 4 status bawaan + status otomatis Alpa (seperti `create_category`, yang dihapus), dengan slug `slugify(name + '-' + nama unit)` unik.
- `update_activity(...)` mengubah nama/kriteria/wilayah (validasi: unit terpilih harus anak langsung owner; min ≤ max; umur 0–120).
- `criteria_templates` diisi 9 templat bawaan di migrasi; klien mengisi formulir dari templat.

### D7. Data publik lewat RPC
- `public_structure()` → desa & kelompok (id, nama, slug, induk).
- `public_kelompok_activities(kelompok_id)` → kegiatan aktif yang mencakup kelompok (owner kelompok itu, desanya, atau daerah), level owner, sesi berjalan (label, jam, `closes_at`), sesi berikutnya, dan hadir/total **untuk peserta dari kelompok itu**. Menggantikan pemakaian `category_summary` di publik.
- `public_activity_participants(category_id)` → peserta sesi berjalan (id, nama, L/P, kelompok) tanpa data pribadi; klien memfilter per kelompok.
- `attendance` tetap terbaca anon (hanya id) untuk realtime seperti sekarang.

### D8. Laporan
`loadReportData` untuk satu kegiatan: sesi tertutup memakai `session_members` (dengan `kelompok_id`), sesi berjalan memakai `activity_participants`. Nama jamaah dibaca admin lewat RLS cakupan. Kolom/ filter kelompok asal ditambahkan ke rekap. RPC `member_history(member, from, to)` (admin dalam cakupan) mengembalikan sesi-sesi yang diikuti (tertutup via snapshot, berjalan via fungsi peserta) beserta status. `session_stats` memakai fungsi peserta untuk sesi yang belum ditutup dan ditambah `owner_unit_id` agar grafik bisa difilter per level.

### D9. Frontend
- Publik: `/` (pilih desa → kelompok, atau redirect ke kelompok tersimpan), `/g/:kelompokSlug` (halaman kelompok, filter Kelompok/Desa/Daerah via `?level=`), `/k/:slug?kelompok=` (kegiatan). Kelompok tersimpan di `localStorage` dengan fallback memori (pola `pinStore`).
- Admin: menu per level — Dasbor (unit & level), Struktur (A, B), Admin (A, B), Jamaah (semua; tulis & import hanya C; perpindahan masuk/keluar untuk C), Kegiatan (semua, milik unit sendiri), Templat (A), Laporan (semua, dalam cakupan), Ganti password.
- Komponen yang ada (sesi, status, PIN, laporan, pagination, aksi massal) dipakai ulang dengan sumber data baru.

### D10. Migrasi & bootstrap
- Migrasi 0014 (skema baru, data lama dihapus dengan `truncate ... cascade`, `category_members` di-drop), 0015 (fungsi peserta, helper wewenang, RLS baru, RPC), 0016 (RPC publik & laporan, view/templat).
- Setelah migrasi, di SQL Editor: `select bootstrap_root_admin('admin1@gmail.com', 'admin', '<Nama Daerah>');` — membuat unit Daerah dan profil Admin Daerah untuk user Auth yang ada. Fungsi ini menolak bila Daerah sudah ada.
- Urutan rilis: ekspor laporan lama bila perlu → migrasi → bootstrap → deploy Edge Function → deploy frontend. Aplikasi lama tidak kompatibel setelah migrasi, jadi migrasi dan deploy frontend dilakukan berdekatan.

### D11. Pengujian
- PGlite: stub Supabase diperluas dengan tabel `auth.users` dan `auth.uid()` dari claim `sub`; helper `asUser(db, userId)`. Test mencakup: peserta (umur batas, marital, wilayah, nonaktif, tanpa tanggal lahir), RLS per level (kelompok/desa/daerah, lintas desa), perpindahan (pending, terima, tolak, batal, snapshot), privasi kolom, bootstrap.
- Vitest: `logic.ts` Edge Function, helper klien (umur, filter, templat, username → email).
- Uji manual di Supabase: pembuatan akun lewat Edge Function, alur ganti password, navigasi publik.

## Risks / Trade-offs

- [Penghapusan data lama tidak bisa dibatalkan] → README meminta ekspor laporan `.xlsx` sebelum migrasi; migrasi dijalankan manual oleh pengguna.
- [Edge Function dideploy manual dan memegang service role] → Kunci hanya di environment function; logika otorisasi diuji; semua aksi mencatat `created_by`.
- [Email sintetis tidak bisa menerima email] → Reset password hanya lewat admin di atasnya (sesuai keputusan).
- [Kelompok tujuan tanpa admin aktif membuat permintaan pindah menggantung] → Kelompok asal dapat membatalkan; jalan keluar lain di luar cakupan.
- [Kelompok asal pada snapshot dicatat saat sesi ditutup, bukan saat mengisi] → Hanya berbeda bila jamaah pindah tepat saat sesi berjalan; diterima.
- [Fungsi peserta dipanggil untuk banyak kegiatan di halaman kelompok/laporan] → Skala target ribuan jamaah; indeks pada `members(kelompok_id)`, `org_units(parent_id)`; dapat di-cache nanti.
- [RLS lebih kompleks → risiko celah] → Setiap kebijakan punya test PGlite untuk ketiga level dan anon.

## Migration Plan

1. (Opsional) ekspor laporan lama. 2. Jalankan migrasi 0014–0016 di SQL Editor. 3. `select bootstrap_root_admin(...)`. 4. Buat Edge Function `admin-accounts` dari editor dashboard dengan isi `supabase/functions/admin-accounts/index.ts` (+ `logic.ts`). 5. Deploy frontend. Rollback: redeploy frontend lama tidak berguna setelah migrasi; rollback data tidak didukung (data lama sudah dihapus atas keputusan pengguna).

## Open Questions

- Batas umur Dewasa L/P diasumsikan 20+ (dapat diubah lewat templat tanpa mengubah spec).
