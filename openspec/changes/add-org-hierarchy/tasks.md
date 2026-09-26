# Tasks

## 1. Database: struktur, jamaah, kegiatan (migrasi 0014)

- [x] 1.1 Perluas stub test PGlite: tabel `auth.users`, `auth.uid()` dari claim `sub`, helper `asUser(db, userId)` dan pembuat admin per level; verifikasi test harness hijau
- [x] 1.2 Migrasi 0014: hapus data lama (`truncate ... cascade`), drop `category_members`, tabel `org_units` (satu Daerah, aturan induk, nama unik per induk, induk tak bisa diubah), `admin_profiles`, kolom baru `members` (kelompok, tanggal lahir, status nikah, nonaktif), `member_transfers`, kolom kegiatan di `categories` (owner, scope_all, kriteria; nama unik per owner), `activity_units`, `criteria_templates` + 9 templat bawaan, `session_members.kelompok_id`; verifikasi test PGlite: Daerah kedua ditolak, kelompok di bawah daerah ditolak, tanggal lahir masa depan ditolak, satu pending transfer per jamaah
- [x] 1.3 `bootstrap_root_admin(email, username, nama_daerah)`; verifikasi test PGlite: membuat Daerah & profil untuk user yang ada, menolak bila Daerah sudah ada atau user tidak ditemukan

## 2. Database: peserta & wewenang (migrasi 0015)

- [x] 2.1 `activity_participants(category, on_date)` (D2); verifikasi test PGlite: batas umur inklusif pada tanggal sesi (ulang tahun ke-16 tepat hari itu masuk, ke-20 sehari sebelumnya keluar), marital belum/pernah (janda masuk Ibu-ibu), tanpa tanggal lahir hanya masuk kegiatan tanpa batas umur, nonaktif sejak tanggal, wilayah kelompok/desa/daerah dengan scope_all dan unit terpilih
- [x] 2.2 Helper `current_admin`, `is_admin` (profil aktif), `unit_in_scope`, `manages_unit`, `can_admin_unit_admins`, `assert_manages_category`; verifikasi test PGlite untuk admin Daerah/Desa/Kelompok, admin nonaktif, dan user Auth tanpa profil
- [x] 2.3 RLS baru semua tabel (D3), anon tanpa akses tabel `members`, trigger larangan ubah `kelompok_id`; verifikasi test PGlite: tiap level hanya membaca/menulis sesuai cakupan, lintas desa ditolak, Desa/Daerah tidak bisa menulis jamaah, anon tidak bisa membaca tanggal lahir/status nikah
- [x] 2.4 Perbarui `set_attendance` (tolak `NOT_PARTICIPANT`), `close_session` (status otomatis ke peserta + snapshot dengan `kelompok_id`), dan semua RPC kegiatan/sesi/status/PIN memakai `assert_manages_category`; verifikasi test PGlite: pengisian oleh bukan peserta ditolak, snapshot berisi kelompok asal, Admin Desa tidak bisa menjadwalkan sesi kegiatan Kelompok
- [x] 2.5 RPC struktur: tambah/ubah/hapus Desa & Kelompok sesuai level (hapus hanya bila kosong, pesan sisa isi); verifikasi test PGlite
- [x] 2.6 RPC kegiatan `create_activity` / `update_activity` (validasi wilayah anak langsung, min ≤ max, slug dari nama + unit), hapus `create_category`; verifikasi test PGlite: nama sama di unit berbeda boleh, di unit sama ditolak, slug unik
- [x] 2.7 RPC jamaah: `import_members` ke kelompok admin (kolom baru, atomik), nonaktif/aktif (tolak saat pending transfer), hapus (tolak bila ada riwayat), aksi massal nonaktif & hapus (lewati yang punya riwayat); verifikasi test PGlite
- [x] 2.8 RPC perpindahan `request_transfer` / `cancel_transfer` / `decide_transfer` (D5); verifikasi test PGlite: pending tetap di asal, terima memindah & tercatat, tolak/batal tanpa perubahan, hanya admin asal/tujuan, jamaah pending tidak bisa dilepas lagi

## 3. Database: publik & laporan (migrasi 0016)

- [x] 3.1 RPC publik `public_structure`, `public_kelompok_activities(kelompok)` (kegiatan mencakup kelompok, level, sesi berjalan/berikutnya, hadir/total peserta kelompok itu), `public_activity_participants(category)`; hapus/ganti `category_summary`; verifikasi test PGlite: kegiatan Desa yang tidak mencakup kelompok tidak tampil, hitungan per kelompok benar, tidak ada kolom pribadi
- [x] 3.2 `session_stats` memakai peserta terhitung + `owner_unit_id`, RPC `member_history(member, from, to)` dalam cakupan; verifikasi test PGlite: riwayat lintas level setelah pindah kelompok, admin di luar cakupan ditolak
- [x] 3.3 Perbarui `seed.sql` (Daerah, 2 Desa, 3 Kelompok, jamaah bertanggal lahir, kegiatan dari templat, sesi) dan semua test DB lama; verifikasi `npm run test:db` hijau

## 4. Akun admin

- [x] 4.1 `supabase/functions/admin-accounts/logic.ts` (validasi username/password/aksi, email sintetis) + `index.ts` (Deno: verifikasi pemanggil, `can_admin_unit_admins`, create/reset/set_active dengan service role, `admin_profiles`); verifikasi test Vitest untuk `logic.ts` dan tinjauan kode function
- [x] 4.2 Klien: login nama pengguna/email (pesan "Nama pengguna atau password salah", akun nonaktif), profil admin (unit & level) di konteks, guard wajib ganti password + halaman `/admin/ganti-password` + `password_changed()`; verifikasi test Vitest (username → email) dan di browser
- [x] 4.3 Halaman Admin (A, B): daftar admin unit bawahan, tambah (username, nama, password sementara), reset password, aktif/nonaktif lewat Edge Function; verifikasi di browser: Admin Desa menambah admin Kelompok yang lalu wajib ganti password

## 5. Admin: struktur, jamaah, kegiatan

- [x] 5.1 Layout & menu per level, dasbor (unit, level, ringkasan); verifikasi di browser untuk ketiga level
- [x] 5.2 Halaman Struktur (A: Desa & Kelompok, B: Kelompok desanya; ubah nama; hapus dengan pesan sisa isi); verifikasi di browser
- [x] 5.3 Halaman Jamaah: daftar dengan filter desa/kelompok/status/data belum lengkap (tersimpan di URL), pagination, pencarian; C: tambah/ubah (tanggal lahir, status nikah), nonaktif/aktif, hapus, aksi massal, import `.xlsx` dengan kolom baru; A/B: hanya lihat; verifikasi di browser dan test Vitest parser import (tanggal Excel/DD/MM/YYYY/YYYY-MM-DD, status nikah)
- [x] 5.4 Perpindahan (C): lepas jamaah ke kelompok tujuan, daftar keluar (batal) & masuk (terima/tolak), penanda "menunggu diterima"; verifikasi di browser antar dua akun kelompok
- [x] 5.5 Kegiatan: daftar kegiatan milik unit, buat dari templat atau kustom (nama, kriteria, wilayah untuk Desa/Daerah), ubah; tab Sesi/Status/Pengaturan lama dipakai ulang dengan peserta terhitung (tab Anggota diganti daftar peserta read-only); verifikasi di browser
- [x] 5.6 Templat (A): CRUD templat kriteria; verifikasi di browser: kegiatan baru memakai templat terbaru, kegiatan lama tidak berubah

## 6. Publik

- [x] 6.1 `/`: pilih Desa → Kelompok, simpan kelompok di perangkat (fallback memori), redirect bila tersimpan, "Ganti kelompok"; verifikasi test Vitest penyimpanan dan di browser
- [x] 6.2 `/g/:kelompokSlug`: filter Kelompok/Desa/Daerah, kartu kegiatan (berjalan di atas, jadwal terdekat, persentase peserta kelompok), pergantian tepat waktu & realtime; verifikasi di browser
- [x] 6.3 `/k/:slug`: peserta dari `public_activity_participants`, filter kelompok (default kelompok tersimpan, "Semua kelompok" dengan nama kelompok), persentase mengikuti filter; PIN, bottom sheet, toast, realtime tetap; verifikasi di browser

## 7. Laporan

- [x] 7.1 Pemilih kegiatan per unit pemilik sesuai cakupan; Rekap & Per anggota dengan kolom dan filter kelompok asal; verifikasi test Vitest agregasi per kelompok dan di browser
- [x] 7.2 Tab "Per jamaah": cari jamaah dalam cakupan, riwayat lintas level + persentase per kegiatan, ekspor `.xlsx`; verifikasi di browser
- [x] 7.3 Grafik antar kegiatan dalam cakupan dengan filter level pemilik dan label unit; verifikasi di browser

## 8. Rilis

- [x] 8.1 README: urutan migrasi 0014–0016, `bootstrap_root_admin`, deploy Edge Function lewat dashboard, peringatan penghapusan data; verifikasi langkah dijalankan di Supabase
- [x] 8.2 Uji menyeluruh di Supabase: Admin Daerah → Desa → admin Desa → Kelompok → admin Kelompok → jamaah → kegiatan dari templat → jadwal → pengisian publik → pindah kelompok → laporan per level & per jamaah; verifikasi di browser di layar 360px

## 9. Masukan uji browser

- [x] 9.1 Permintaan pindah menampilkan data jamaah untuk kelompok tujuan (`list_transfers`, migrasi 0017); verifikasi test PGlite dan di browser
- [x] 9.2 Alasan pindah & alasan tolak opsional (migrasi 0018, dialog Tolak); verifikasi test PGlite dan di browser
- [x] 9.3 Cache admin dibuang saat akun berganti (tidak tampil data akun sebelumnya setelah login); verifikasi test Vitest dan di browser
