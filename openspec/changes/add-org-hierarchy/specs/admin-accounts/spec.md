# Spec Delta

## Purpose

Mengatur akun admin berjenjang (Daerah, Desa, Kelompok): siapa membuat akun siapa, cara login dengan nama pengguna, pengelolaan akun oleh level di atasnya, dan batas wewenang tiap admin terhadap unitnya.

## ADDED Requirements

### Requirement: Peran admin berjenjang
Setiap akun admin SHALL terikat pada tepat satu unit (Daerah, Desa, atau Kelompok) dan memiliki level sesuai unit itu. Satu unit SHALL boleh memiliki lebih dari satu admin. Akun admin SHALL memiliki nama pengguna unik (huruf kecil, angka, titik, garis bawah; 3–32 karakter) dan nama tampilan.

#### Scenario: Beberapa admin satu kelompok
- **WHEN** Admin Desa CNT menambahkan dua admin untuk Kelompok Baitul Ilmi
- **THEN** keduanya dapat login dan memiliki wewenang yang sama atas Kelompok Baitul Ilmi

#### Scenario: Nama pengguna dipakai
- **WHEN** admin menambah akun dengan nama pengguna yang sudah dipakai akun lain
- **THEN** sistem menolak dan menampilkan pesan bahwa nama pengguna sudah dipakai

### Requirement: Menambah admin
Admin Daerah SHALL dapat menambah admin untuk Desa mana pun; Admin Desa SHALL dapat menambah admin untuk Kelompok di Desanya; Admin Kelompok SHALL NOT dapat menambah admin. Admin yang menambah SHALL menentukan nama pengguna, nama tampilan, dan password sementara (minimal 8 karakter). Akun baru SHALL wajib mengganti password saat login pertama. Pembuatan akun SHALL diperiksa di server; klien SHALL NOT memegang kunci layanan.

#### Scenario: Admin Desa menambah admin Kelompok
- **WHEN** Admin Desa CNT menambah admin "ahmad.baitulilmi" untuk Kelompok Baitul Ilmi dengan password sementara
- **THEN** akun dibuat, dapat login dengan nama pengguna itu, dan diminta mengganti password pada login pertama

#### Scenario: Di luar wewenang
- **WHEN** Admin Desa CNT mencoba menambah admin untuk Kelompok di Desa CNB, atau Admin Kelompok mencoba menambah admin mana pun
- **THEN** server menolak dan tidak ada akun yang dibuat

### Requirement: Kelola akun admin di bawahnya
Admin SHALL dapat melihat daftar admin unit-unit yang boleh ia tambahkan adminnya, menonaktifkan dan mengaktifkan kembali akun tersebut, serta mereset password-nya ke password sementara baru (wajib diganti saat login berikutnya). Akun nonaktif SHALL NOT dapat login atau mengakses data admin. Akun admin SHALL NOT dihapus, agar jejaknya tetap ada. Admin SHALL NOT dapat menonaktifkan akunnya sendiri.

#### Scenario: Pergantian pengurus
- **WHEN** Admin Desa menonaktifkan akun admin Kelompok yang sudah tidak menjabat
- **THEN** akun itu tidak bisa login lagi dan permintaan dengan sesi lamanya ditolak server

#### Scenario: Lupa password
- **WHEN** admin Kelompok lupa password dan Admin Desa meresetnya
- **THEN** admin Kelompok dapat login dengan password sementara baru dan diminta menggantinya

### Requirement: Cakupan wewenang admin
Server SHALL membatasi setiap operasi admin sesuai unitnya. Admin Kelompok SHALL mengelola jamaah, kegiatan, dan sesi milik Kelompoknya. Admin Desa SHALL mengelola Kelompok, admin Kelompok, dan kegiatan milik Desanya, serta hanya melihat jamaah dan laporan kelompok di Desanya. Admin Daerah SHALL mengelola Desa, Kelompok, admin Desa, templat kriteria, dan kegiatan milik Daerah, serta hanya melihat jamaah dan laporan seluruh Daerah. Admin SHALL NOT mengubah kegiatan, status, PIN, atau sesi milik unit lain, termasuk unit di bawahnya.

#### Scenario: Admin Desa tidak mengubah kegiatan Kelompok
- **WHEN** Admin Desa CNT mencoba menjadwalkan sesi untuk kegiatan milik Kelompok Baitul Ilmi
- **THEN** server menolak

#### Scenario: Admin Daerah hanya melihat jamaah
- **WHEN** Admin Daerah mencoba mengubah tanggal lahir seorang jamaah
- **THEN** server menolak, dan data jamaah tetap dapat dilihat di menu jamaah Admin Daerah

#### Scenario: Admin Kelompok tidak melihat kelompok lain
- **WHEN** admin Kelompok Baitul Ilmi membuka daftar jamaah atau laporan
- **THEN** hanya jamaah dan kegiatan milik Kelompok Baitul Ilmi yang tampil
