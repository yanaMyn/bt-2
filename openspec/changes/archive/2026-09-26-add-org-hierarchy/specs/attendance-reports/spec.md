# Spec Delta

## ADDED Requirements

### Requirement: Cakupan laporan per level
Laporan SHALL hanya mencakup kegiatan dalam cakupan admin: admin Kelompok melihat kegiatan milik kelompoknya; Admin Desa melihat kegiatan milik Desanya dan milik semua kelompok di Desanya; Admin Daerah melihat semua kegiatan. Pemilih kegiatan di laporan SHALL dikelompokkan per unit pemilik. Rekap kegiatan milik Desa atau Daerah SHALL dapat difilter per desa/kelompok asal peserta, dan daftar peserta di rekap SHALL menampilkan desa dan kelompok asal tiap peserta sesuai data sesi (dibekukan saat sesi selesai).

#### Scenario: Admin Desa melihat kegiatan kelompok
- **WHEN** Admin Desa CNT membuka laporan
- **THEN** pemilih kegiatan berisi kegiatan milik Desa CNT dan kegiatan milik Kelompok Baitul Ilmi dan Citra, tetapi tidak kegiatan milik Desa CNB

#### Scenario: Rekap Desa per kelompok
- **WHEN** Admin Desa membuka rekap "Desaan CNT" dan memilih filter Kelompok Citra
- **THEN** tabel status dan persentase hanya menghitung peserta yang berasal dari Kelompok Citra

#### Scenario: Asal kelompok setelah pindah
- **WHEN** Budi pindah dari Baitul Ilmi ke Citra pada 1 Oktober 2026 dan admin membuka rekap "Desaan CNT" September–Oktober 2026
- **THEN** baris Budi pada sesi September berasal Baitul Ilmi dan pada sesi Oktober berasal Citra

### Requirement: Riwayat kehadiran per jamaah
Admin SHALL dapat mencari seorang jamaah dalam cakupannya dan memilih tanggal/rentang untuk melihat semua sesi yang ia ikuti sebagai peserta dari kegiatan milik level mana pun (Kelompok, Desa, Daerah): tanggal, kegiatan, unit pemilik, kelompok asal saat itu, dan statusnya, beserta persentase hadir keseluruhan dan per kegiatan. Riwayat ini SHALL dapat diekspor ke `.xlsx`.

#### Scenario: Riwayat lintas level
- **WHEN** Admin Desa membuka riwayat Budi untuk Oktober 2026
- **THEN** tampil sesi "Remaja" (Kelompok Citra), "Desaan CNT" (Desa CNT), dan "Pengajian Daerah" (Daerah) yang diikuti Budi beserta statusnya dan persentase per kegiatan

#### Scenario: Di luar cakupan
- **WHEN** admin Kelompok Citra mencari jamaah Kelompok Baitul Ilmi
- **THEN** jamaah itu tidak ditemukan

## MODIFIED Requirements

### Requirement: Rekap per anggota
Admin SHALL dapat memilih sebuah kegiatan dalam cakupannya dan tanggal/rentang (default: "Semua"), lalu melihat tabel per peserta berisi kelompok asal, jumlah kemunculan tiap status, jumlah sesi tanpa isian ("Belum"), jumlah sesi, dan persentase hadir peserta tersebut (jumlah sesi dengan status dihitung hadir dibagi jumlah sesi dalam pilihan ketika ia menjadi peserta). Untuk kegiatan milik Desa atau Daerah, tabel SHALL dapat difilter per desa/kelompok asal.

#### Scenario: Rekap anggota
- **WHEN** admin membuka rekap per anggota kegiatan "Remaja" dengan pilihan yang mencakup 9 sesi dan Ahmad tercatat Hadir 8 kali serta Izin 1 kali
- **THEN** baris Ahmad menampilkan kelompok asalnya, Hadir 8, Izin 1, dan persentase 89%

### Requirement: Grafik perbandingan antar kategori
Panel admin SHALL menyediakan grafik batang yang membandingkan persentase hadir antar kegiatan dalam cakupan admin untuk tanggal/rentang terpilih (default: "Bulan ini"), diurutkan dari tertinggi, dengan filter level pemilik (Kelompok, Desa, Daerah) sesuai cakupan. Untuk setiap kegiatan dipakai gabungan semua sesinya dalam pilihan, dengan perhitungan yang sama seperti rekap; setiap batang menampilkan unit pemilik, jumlah sesi, dan jumlah hadir/total. Kegiatan yang tidak memiliki sesi dalam pilihan SHALL tetap tercantum dengan keterangan "tidak ada sesi" tanpa batang. Kegiatan nonaktif SHALL ditandai "Nonaktif". Grafik SHALL NOT tersedia di halaman publik.

#### Scenario: Rentang bulan
- **WHEN** Admin Desa membuka grafik dengan rentang 1–30 September 2026
- **THEN** setiap kegiatan dalam cakupan Desa tampil dengan unit pemiliknya dan persentase hadir gabungan sesi-sesinya yang bertanggal September 2026, diurutkan dari tertinggi

#### Scenario: Kategori tanpa sesi
- **WHEN** admin memilih satu tanggal dan kegiatan "Lansia" tidak memiliki sesi pada tanggal itu
- **THEN** "Lansia" tercantum dengan keterangan "tidak ada sesi" di akhir daftar
