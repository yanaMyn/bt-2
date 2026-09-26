# Spec Delta

## Purpose

Mengelola data orang (nama dan jenis kelamin) secara global dan keanggotaannya di satu atau lebih kategori, sehingga orang yang sama bisa diabsen di beberapa grup.

## ADDED Requirements

### Requirement: Data orang global
Admin SHALL dapat membuat, melihat, mencari, dan mengubah data orang dengan atribut nama (wajib, tidak kosong) dan jenis kelamin (L atau P). Perubahan nama atau jenis kelamin SHALL berlaku di semua kategori tempat orang tersebut tergabung.

#### Scenario: Mengubah nama orang
- **WHEN** admin mengubah nama "Budi" menjadi "Budi Santoso" dan Budi tergabung di "Kelas A" dan "Kajian"
- **THEN** kedua kategori menampilkan "Budi Santoso"

#### Scenario: Validasi jenis kelamin
- **WHEN** admin menyimpan orang tanpa memilih jenis kelamin
- **THEN** sistem menolak dan menampilkan pesan validasi

### Requirement: Keanggotaan banyak kategori
Satu orang SHALL dapat menjadi anggota lebih dari satu kategori, dan tidak boleh tergabung dua kali di kategori yang sama. Di halaman sebuah kategori, admin SHALL dapat menambahkan orang yang sudah ada (melalui pencarian) atau membuat orang baru sekaligus menambahkannya.

#### Scenario: Menautkan orang yang sudah ada
- **WHEN** admin di kategori "Kajian" mencari "Budi" lalu memilih Budi yang sudah ada di "Kelas A"
- **THEN** Budi menjadi anggota "Kajian" tanpa membuat data orang baru, dan kehadirannya di kedua kategori tercatat terpisah

#### Scenario: Menambah orang baru dari kategori
- **WHEN** admin di kategori "Kelas A" memilih "Buat orang baru" dan mengisi nama serta jenis kelamin
- **THEN** orang baru dibuat dan langsung menjadi anggota "Kelas A"

#### Scenario: Keanggotaan ganda di kategori yang sama
- **WHEN** admin menambahkan orang yang sudah menjadi anggota kategori tersebut
- **THEN** sistem menolak dan memberi tahu bahwa orang itu sudah tergabung

### Requirement: Keluarkan dari kategori berbeda dengan hapus orang
Sistem SHALL menyediakan dua aksi terpisah: "Keluarkan dari kategori" yang hanya melepas keanggotaan dengan tetap mempertahankan riwayat kehadiran sesi lama, dan "Hapus orang" yang menghapus data orang dari seluruh sistem.

#### Scenario: Keluarkan dari kategori
- **WHEN** admin mengeluarkan Budi dari "Kelas A"
- **THEN** Budi tidak lagi tampil di daftar "Kelas A" dan tidak dihitung di sesi aktif, tetap menjadi anggota "Kajian", dan laporan sesi lama "Kelas A" tetap menampilkan catatannya

#### Scenario: Hapus orang tanpa riwayat
- **WHEN** admin menghapus orang yang belum memiliki catatan kehadiran
- **THEN** orang terhapus setelah konfirmasi biasa

#### Scenario: Hapus orang dengan riwayat
- **WHEN** admin menghapus orang yang sudah memiliki catatan kehadiran
- **THEN** sistem meminta konfirmasi dengan mengetik nama orang tersebut, lalu menghapus orang beserta seluruh keanggotaan dan catatan kehadirannya
