# Tasks

## 1. Database: jam sesi & keadaan

- [x] 1.1 Migrasi 0012 bagian skema: kolom `start_time`, `end_time`, `grace_hours` (0/6/12/24), `opens_at`, `closes_at` + trigger pengisi (D1), constraint jam lengkap & `end_time > start_time`, hapus unique index `sessions_one_active_key`; verifikasi test PGlite: 19.30–21.00 + 6 jam pada 5 Okt 2026 menghasilkan `opens_at` 12.30Z dan `closes_at` 20.00Z, mengubah tanggal menggeser keduanya, jam tidak valid ditolak
- [x] 1.2 Fungsi `current_session(category)` (D2) dan `set_attendance` memakainya (tolak sebelum jam mulai, setelah batas, dan untuk sesi tergantikan); verifikasi test PGlite dengan sesi relatif terhadap `now()`: dijadwalkan ditolak, berjalan diterima, lewat batas ditolak, dua sesi terbuka → yang dibuka terakhir menerima isian, sesi lama tanpa jam tetap berjalan
- [x] 1.3 `close_session` internal, `end_session` memakainya, `finalize_due_sessions()` & `finalize_category()` (D3) dengan `closed_at` = waktu efektif; `set_attendance` memanggil `finalize_category`; verifikasi test PGlite: sesi lewat batas difinalisasi dengan Alpa & snapshot, sesi tergantikan ditutup pada jam buka sesi pengganti, pemanggilan berulang idempoten
- [x] 1.4 RPC admin `schedule_sessions` (1–62 item, validasi, atomik), `update_session` (aturan per keadaan), `delete_session` (hanya dijadwalkan tanpa isian); hapus `start_session`, cabut policy update langsung `sessions`, `create_category` tanpa sesi; verifikasi test PGlite: 63 item ditolak, satu item tidak valid membatalkan semua, ubah jam sesi selesai ditolak, hapus sesi berjalan ditolak, anon ditolak
- [x] 1.5 View `category_summary` (sesi berjalan via `current_session`, jam, `next_opens_at`, `next_session_label`) dan `session_stats` (hanya sesi yang sudah dibuka); verifikasi test PGlite untuk kategori berjalan, menunggu sesi berikutnya, dan tanpa jadwal
- [x] 1.6 Migrasi 0013: aktifkan `pg_cron` dan jadwalkan `finalize_due_sessions` setiap menit di dalam blok yang aman gagal; verifikasi migrasi lolos di PGlite (tanpa `pg_cron`) dan SQL-nya ditinjau untuk Supabase
- [x] 1.7 Perbarui test DB lama & `seed.sql` yang memakai `start_session`/sesi tanpa jam/kategori-dengan-sesi-otomatis; verifikasi `npm run test:db` hijau

## 2. Logika murni (klien)

- [x] 2.1 Helper keadaan sesi (`sessionState(session, now)`), format jam "19.30–21.00", toleransi "+6 jam", teks "Absen dibuka <hari, tanggal> pukul <jam>", dan batas perubahan berikutnya untuk timer (D6); verifikasi test Vitest
- [x] 2.2 `recurringDates(weekdays, from, to)` dan `markDuplicates(dates, start, existing)` (D7) dengan batas 62; verifikasi test Vitest: Senin & Kamis Oktober 2026 → 9 tanggal, duplikat jam mulai sama ditandai, rentang terbalik ditukar
- [x] 2.3 `sessionsInRange`/`rangeRecap`/`compareByRange`/`allRange` mengabaikan sesi dijadwalkan; verifikasi test Vitest

## 3. API & tipe

- [x] 3.1 Tipe `Session`/`CategorySummary` dengan kolom jam & keadaan; API admin `scheduleSessions`, `updateSession` (jam), `deleteSession`, `finalizeDueSessions`; `loadReportData` memuat semua sesi (tab Sesi) sementara laporan hanya memakai sesi yang sudah dibuka (`sessionsInRange`, daftar tanggal laporan); halaman publik memakai `current_session_id`; hapus `startSession`; pesan error baru (jam tidak valid, terlalu banyak sesi, sesi tidak bisa dihapus); verifikasi `npm run typecheck`

## 4. Admin: tab Sesi

- [x] 4.1 Tombol "Jadwalkan sesi" dengan mode Satu sesi & Berulang (hari dalam seminggu, jam mulai/selesai, toleransi, rentang, catatan), pratinjau tanggal dengan checkbox & tanda duplikat; verifikasi di browser: Senin & Kamis Oktober menghasilkan 9 sesi
- [x] 4.2 Riwayat sesi dengan penanda dijadwalkan/berjalan/selesai, jam & toleransi, urutan (dijadwalkan terdekat, berjalan, selesai terbaru), "Ubah jadwal/catatan" sesuai keadaan, "Hapus" untuk sesi dijadwalkan, "Akhiri sesi" untuk sesi berjalan; panggil `finalize_due_sessions` saat tab dibuka; verifikasi di browser
- [x] 4.3 Kategori baru tanpa sesi: daftar kategori admin menampilkan "Belum ada jadwal sesi"/"Absen dibuka …"; verifikasi di browser

## 5. Publik

- [x] 5.1 Beranda: kartu berjalan (label, jam, %), menunggu ("Absen dibuka …"), tanpa jadwal; timer berganti tepat waktu (D6); verifikasi di browser dengan sesi yang mulai 1–2 menit ke depan
- [x] 5.2 Halaman kategori: label, jam, catatan sesi berjalan; layar menunggu dengan waktu buka; beralih otomatis saat jam mulai dan saat sesi selesai; pesan dari server bila pengisian ditolak di luar jendela; verifikasi di browser

## 6. Penyelesaian

- [x] 6.1 README: aktivasi `pg_cron`, urutan migrasi 0012–0013, perilaku jadwal; verifikasi instruksi dijalankan di Supabase dan job terlihat di `cron.job`
- [x] 6.2 Uji menyeluruh di Supabase: jadwalkan sesi yang mulai dan selesai dalam beberapa menit (tanpa toleransi), pastikan terbuka otomatis, tertutup otomatis, dan Alpa tercatat tanpa admin menekan apa pun; verifikasi di browser & laporan
