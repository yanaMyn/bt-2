# Proposal

## Why

Saat ini sesi hanya punya tanggal. Admin harus menekan "Akhiri sesi" dan "Buat sesi baru" secara manual untuk setiap pengajian, padahal pengajian bisa berlangsung sampai 8 kali sebulan (2× seminggu). Admin juga tidak bisa mengatur jam pengisian absen. Sesi perlu punya jam berlangsung yang membuka dan menutup absen otomatis, dengan toleransi bagi jamaah yang terlambat absen, dan bisa dijadwalkan sekaligus untuk sebulan.

## What Changes

- **BREAKING (perilaku sesi):** setiap sesi baru wajib memiliki jam mulai dan jam selesai (WIB, di hari yang sama dengan tanggal sesi) serta toleransi opsional: tanpa toleransi, 6, 12, atau 24 jam.
- Sesi memiliki tiga keadaan: **dijadwalkan** (sebelum jam mulai), **berjalan** (dari jam mulai sampai jam selesai + toleransi), dan **selesai**.
- Pengisian absen publik baru dibuka pada jam mulai dan otomatis ditutup setelah jam selesai + toleransi. Saat ditutup, anggota yang belum mengisi dicatat dengan status otomatis kategori (mis. Alpa), sama seperti "Akhiri sesi".
- Bila sesi berikutnya di kategori yang sama sudah mulai sementara sesi sebelumnya masih dalam toleransi, sesi sebelumnya otomatis selesai. Orang tua selalu mengisi sesi terbaru.
- Admin dapat **menjadwalkan banyak sesi sekaligus**: pilih hari dalam seminggu (mis. Senin & Kamis), jam mulai–selesai, toleransi, rentang tanggal, dan catatan opsional; pratinjau daftar tanggal; lalu simpan semuanya. Setiap sesi hasil jadwal tetap bisa diubah atau dihapus satu per satu, dan sesi tunggal tetap bisa dibuat.
- "Buat sesi baru" diganti "Jadwalkan sesi" (tunggal atau berulang). Satu kategori boleh memiliki banyak sesi dijadwalkan. Aturan "akhiri sesi aktif dulu" dihapus.
- "Akhiri sesi" tetap ada untuk mengakhiri sesi berjalan lebih cepat. Sesi dijadwalkan yang belum dimulai dan belum memiliki isian dapat dihapus.
- **BREAKING:** kategori baru tidak lagi otomatis memiliki sesi hari ini; admin menjadwalkan sesi berjam.
- Sesi lama tanpa jam tetap berjalan sampai diakhiri manual.
- Halaman orang tua menampilkan jam sesi dan, bila belum dibuka, kapan absen dibuka ("Absen dibuka Senin, 5 Oktober 2026 pukul 19.30"); beranda menampilkan keadaan yang sama.
- Laporan dan grafik tidak memasukkan sesi yang masih dijadwalkan.
- Di luar cakupan: sesi yang melewati tengah malam, toleransi selain pilihan yang tersedia, notifikasi/pengingat ke orang tua, dan hierarki Daerah/Desa/Kelompok (change terpisah).

## Capabilities

### New Capabilities
<!-- Tidak ada kapabilitas baru; penjadwalan adalah bagian dari attendance-sessions. -->

### Modified Capabilities
- `attendance-sessions`: sesi berjam dengan toleransi, keadaan dijadwalkan/berjalan/selesai, pembukaan & penutupan otomatis, sesi lama tergantikan oleh sesi baru yang mulai, penjadwalan berulang, hapus sesi dijadwalkan, "Buat sesi baru" diganti "Jadwalkan sesi", kategori baru tanpa sesi otomatis.
- `attendance-recording`: beranda dan halaman kategori menampilkan keadaan sesi (dijadwalkan dengan waktu buka, berjalan dengan jam, tidak ada jadwal); pengisian ditolak di luar jendela waktu sesi.
- `category-management`: membuat kategori tidak lagi membuat sesi aktif otomatis.
- `attendance-reports`: sesi yang masih dijadwalkan (belum mulai) tidak termasuk dalam rekap, rekap per anggota, maupun grafik.

## Impact

- Database: kolom baru di `sessions` (jam mulai/selesai, toleransi), aturan "paling banyak satu sesi berjalan" ditegakkan lewat logika waktu (indeks unik sesi terbuka dihapus), fungsi penutupan otomatis, RPC penjadwalan & hapus sesi, perubahan `set_attendance`, `create_category`, `category_summary`, `session_stats`.
- Supabase: ekstensi `pg_cron` (tersedia di paket Free) untuk menjalankan penutupan otomatis setiap menit; migrasi tetap bisa diterapkan tanpa `pg_cron` (lingkungan test).
- Frontend: tab Sesi admin (jadwalkan tunggal/berulang, pratinjau, keadaan sesi), halaman publik & beranda (keadaan sesi, pembaruan tampilan tepat pada jam mulai), laporan (abaikan sesi dijadwalkan).
- Data lama: sesi yang sudah ada tanpa jam tetap berlaku; tidak ada data yang diubah.
