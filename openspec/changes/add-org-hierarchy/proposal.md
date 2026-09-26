# Proposal

## Why

Pengajian diselenggarakan berjenjang: Daerah, Desa, dan Kelompok. Setiap kelompok punya beberapa jenis pengajian yang pesertanya ditentukan umur, jenis kelamin, dan status nikah (Caberawit, Remaja, Muda Mudi, Ibu-ibu, dan seterusnya). Model saat ini ("kategori" dengan anggota yang diinput manual per kategori, satu jenis admin) memaksa data jamaah diinput berulang untuk tiap pengajian. Contoh nyata di produksi: jamaah Desaan CNT tidak berbagi satu pun data orang dengan jamaah kelompoknya, dan ada 14 data orang yatim. Model ini juga tidak bisa membedakan wewenang pengurus Daerah, Desa, dan Kelompok, dan tidak mendukung jamaah yang pindah kelompok.

## What Changes

- **Struktur organisasi:** satu Daerah (akar) per aplikasi → Desa → Kelompok, dikelola admin di atasnya.
- **Akun admin berjenjang:** Admin Daerah menambah admin Desa, dan admin Desa menambah admin Kelompok (boleh lebih dari satu per unit). Login memakai **nama pengguna** (email tidak wajib) dengan password sementara yang wajib diganti saat login pertama. Admin di atasnya bisa menonaktifkan akun dan mereset password. Satu akun untuk satu unit.
- **BREAKING — jamaah milik kelompok:** setiap jamaah punya tepat satu kelompok asal, dengan data nama, jenis kelamin, tanggal lahir, dan status nikah (belum menikah / menikah / janda-duda). Hanya admin Kelompok yang boleh menambah, mengubah, menghapus, atau mengimpor jamaahnya; admin Desa dan Daerah hanya melihat.
- **Pindah kelompok dua langkah:** admin kelompok asal melepas ke kelompok tujuan, lalu admin kelompok tujuan menerima atau menolak. Selama menunggu, jamaah tetap di kelompok asal; perpindahan berlaku sejak tanggal diterima, dan riwayat perpindahan dicatat.
- **Jamaah nonaktif:** jamaah yang meninggal, pindah ke luar daerah, atau berhenti karena alasan lain dinonaktifkan sejak tanggal tertentu dan bisa diaktifkan lagi; riwayat kehadirannya tetap. Hapus permanen hanya untuk jamaah tanpa riwayat.
- **BREAKING — "Kategori" menjadi "Kegiatan":** setiap kegiatan dimiliki satu unit (Daerah, Desa, atau Kelompok). Pesertanya **dihitung otomatis** dari wilayah (kelompoknya sendiri; kelompok-kelompok pilihan untuk kegiatan Desa; desa-desa pilihan untuk kegiatan Daerah) dan **kriteria** (jenis kelamin, rentang umur yang dihitung pada tanggal sesi, status nikah). Keanggotaan manual per kategori dihapus. Status, PIN, dan jadwal sesi tetap per kegiatan seperti sekarang.
- **Templat kriteria** yang bisa diatur Admin Daerah, dengan nilai bawaan: Caberawit 5–11, Pra Remaja 12–15, Remaja 16–19, Muda Mudi 20+ belum menikah, Dewasa L / Dewasa P 20+, Bapak-bapak / Ibu-ibu pernah menikah, Lansia 50+. Admin boleh membuat kegiatan dengan kriteria sendiri.
- **Peserta sesi dibekukan saat sesi selesai**, termasuk kelompok asal tiap peserta, sehingga riwayat tetap benar walau jamaah pindah, dinonaktifkan, bertambah umur, atau berubah status nikah.
- **BREAKING — halaman orang tua:** pertama kali memilih Desa lalu Kelompok (diingat di perangkat). Halaman kelompok menampilkan kegiatan yang mengikutkan kelompok itu, dengan filter Kelompok / Desa / Daerah (yang sedang berlangsung di atas). Daftar nama kegiatan Desa/Daerah secara bawaan difilter ke kelompok pengguna. Link per kegiatan tetap bisa dibagikan.
- **Laporan sesuai cakupan:** admin Kelompok melihat kegiatan kelompoknya; admin Desa melihat kegiatan desa dan semua kelompok di bawahnya; admin Daerah melihat semua. Laporan menampilkan asal desa/kelompok peserta, bisa difilter per kelompok, dan ada riwayat kehadiran per jamaah lintas kegiatan dan level.
- **Mulai bersih:** migrasi menghapus seluruh data lama (kategori, jamaah, sesi, kehadiran). Akun admin yang ada dijadikan Admin Daerah.
- Di luar cakupan: lebih dari satu Daerah per aplikasi, satu akun untuk beberapa unit, riwayat perubahan status nikah, jalan keluar bila kelompok tujuan perpindahan tidak punya admin aktif, dan notifikasi.

## Capabilities

### New Capabilities
- `org-structure`: Daerah sebagai akar tunggal, Desa, dan Kelompok beserta pengelolaannya per level.
- `admin-accounts`: peran admin berjenjang (level + unit), penambahan admin oleh level di atasnya dengan nama pengguna dan password sementara, penonaktifan dan reset password, serta cakupan akses per unit.

### Modified Capabilities
- `admin-auth`: login dengan nama pengguna atau email, wajib ganti password saat login pertama, dan proteksi server berdasarkan peran dan unit.
- `member-management`: jamaah milik satu kelompok dengan tanggal lahir dan status nikah; hanya admin Kelompok yang mengelola; pindah kelompok dua langkah; jamaah nonaktif; hapus terbatas; filter jamaah per desa/kelompok/status/data belum lengkap; keanggotaan manual per kategori dihapus.
- `member-import`: impor ke kelompok milik admin, template dengan kolom Tanggal Lahir dan Status Nikah.
- `category-management`: kategori menjadi kegiatan milik satu unit, dengan wilayah dan kriteria peserta serta templat kriteria.
- `attendance-recording`: navigasi publik Desa → Kelompok → kegiatan dengan filter level; halaman kegiatan menampilkan peserta otomatis dengan filter kelompok.
- `attendance-sessions`: peserta sesi dihitung otomatis dan dibekukan (dengan kelompok asal) saat sesi selesai.
- `attendance-reports`: cakupan laporan per level, asal kelompok, filter kelompok, dan riwayat per jamaah.

## Impact

- **Database:** tabel baru `org_units`, `admin_profiles`, `member_transfers`, `activity_units`, `criteria_templates`; kolom baru di `members` (kelompok, tanggal lahir, status nikah, nonaktif) dan `categories` (unit pemilik, kriteria); `category_members` dihapus; `session_members` menyimpan kelompok asal. Fungsi peserta, RLS berbasis unit untuk semua tabel admin, dan pembaruan `set_attendance`, `close_session`, `category_summary`, `session_stats`. Migrasi **menghapus seluruh data lama**.
- **Supabase:** Edge Function baru `admin-accounts` (buat admin, reset password, aktif/nonaktif) yang memakai service role, dideploy lewat editor dashboard. Pendaftaran akun tetap dimatikan.
- **Frontend:** layar login (nama pengguna, ganti password), panel admin berbasis peran (struktur, admin, jamaah, perpindahan, kegiatan, templat), halaman publik baru (pilih desa/kelompok, halaman kelompok), laporan berdasarkan cakupan.
- **Operasional:** perlu ekspor laporan lama sebelum migrasi bila ingin disimpan; aplikasi live tetap berjalan sampai migrasi dan frontend baru dirilis bersamaan.
