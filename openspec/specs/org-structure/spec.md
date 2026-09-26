# org-structure Specification

## Purpose

Memodelkan struktur organisasi pengajian berjenjang (satu Daerah sebagai akar, Desa, dan Kelompok) yang menjadi dasar kepemilikan jamaah, kegiatan, wewenang admin, dan cakupan laporan.

## Requirements

### Requirement: Satu Daerah sebagai akar
Aplikasi SHALL memiliki tepat satu unit Daerah sebagai akar struktur. Setiap Desa SHALL berada di bawah Daerah dan setiap Kelompok SHALL berada di bawah tepat satu Desa. Nama Daerah SHALL dapat diubah oleh Admin Daerah.

#### Scenario: Struktur awal
- **WHEN** migrasi struktur organisasi dijalankan dan akun admin yang ada dijadikan Admin Daerah
- **THEN** terdapat satu unit Daerah tanpa Desa dan Kelompok, dan Admin Daerah dapat mengganti namanya

#### Scenario: Daerah kedua ditolak
- **WHEN** ada upaya membuat unit Daerah kedua
- **THEN** server menolak

### Requirement: Kelola Desa
Admin Daerah SHALL dapat menambah, mengubah nama, dan menghapus Desa. Nama Desa SHALL unik di dalam Daerah. Admin Desa dan Admin Kelompok SHALL NOT dapat menambah, mengubah, atau menghapus Desa.

#### Scenario: Menambah Desa
- **WHEN** Admin Daerah menambah Desa "CNT"
- **THEN** Desa "CNT" tampil di struktur dan di pilihan desa halaman publik

#### Scenario: Nama Desa duplikat
- **WHEN** Admin Daerah menambah Desa dengan nama yang sudah dipakai Desa lain (tanpa membedakan huruf besar)
- **THEN** sistem menolak dan menampilkan pesan bahwa nama sudah dipakai

#### Scenario: Admin Desa tidak bisa mengubah Desa
- **WHEN** Admin Desa mencoba mengubah nama Desa lewat API
- **THEN** server menolak

### Requirement: Kelola Kelompok
Admin Daerah SHALL dapat menambah, mengubah nama, dan menghapus Kelompok di Desa mana pun; Admin Desa SHALL dapat melakukannya hanya untuk Kelompok di Desanya. Nama Kelompok SHALL unik di dalam Desa yang sama. Kelompok SHALL NOT dapat dipindah ke Desa lain.

#### Scenario: Admin Desa menambah Kelompok
- **WHEN** Admin Desa CNT menambah Kelompok "Baitul Ilmi"
- **THEN** Kelompok "Baitul Ilmi" berada di bawah Desa CNT

#### Scenario: Kelompok di Desa lain ditolak
- **WHEN** Admin Desa CNT mencoba mengubah Kelompok milik Desa CNB
- **THEN** server menolak

### Requirement: Hapus unit
Desa atau Kelompok SHALL hanya dapat dihapus bila tidak memiliki unit di bawahnya, jamaah (aktif maupun nonaktif), kegiatan, maupun admin. Bila masih ada, sistem SHALL menolak dan menyebutkan apa yang masih tersisa.

#### Scenario: Hapus Kelompok kosong
- **WHEN** Admin Desa menghapus Kelompok yang belum memiliki jamaah, kegiatan, maupun admin
- **THEN** Kelompok terhapus

#### Scenario: Hapus Kelompok berisi jamaah
- **WHEN** Admin Desa menghapus Kelompok yang masih memiliki 12 jamaah
- **THEN** sistem menolak dan menyebutkan bahwa kelompok masih memiliki jamaah
