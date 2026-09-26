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

### Requirement: Aksi massal anggota
Admin SHALL dapat memilih banyak orang sekaligus di tab Anggota sebuah kategori dan di menu Anggota global, dengan kotak centang per baris dan "Pilih semua" yang berlaku untuk seluruh hasil pencarian di semua halaman. Di tab Anggota kategori tersedia aksi massal "Keluarkan dari kategori" dan "Hapus orang"; di menu Anggota global tersedia "Hapus orang". Aksi massal SHALL dijalankan atomik: semua orang terpilih diproses, atau tidak ada sama sekali bila terjadi kegagalan. Bila di antara orang yang akan dihapus ada yang memiliki riwayat kehadiran, dialog konfirmasi SHALL menyebut jumlahnya dan meminta admin mengetik "HAPUS".

#### Scenario: Keluarkan banyak orang dari kategori
- **WHEN** admin memilih 5 anggota di tab Anggota "Kelas A" lalu memilih "Keluarkan dari kategori" dan mengonfirmasi
- **THEN** kelima orang tidak lagi menjadi anggota "Kelas A", tetap ada di kategori lain dan menu Anggota, dan riwayat sesi yang sudah ditutup tetap ada di laporan

#### Scenario: Pilih semua hasil pencarian
- **WHEN** admin mengetik "Fa" di pencarian lalu menekan "Pilih semua"
- **THEN** semua orang yang cocok dengan pencarian terpilih, termasuk yang berada di halaman lain, dan orang yang tidak cocok tidak terpilih

#### Scenario: Hapus banyak orang tanpa riwayat
- **WHEN** admin memilih 10 orang hasil import yang salah, yang belum memiliki catatan kehadiran, lalu memilih "Hapus orang"
- **THEN** sistem meminta konfirmasi biasa lalu menghapus kesepuluh orang dari semua kategori

#### Scenario: Hapus banyak orang dengan riwayat
- **WHEN** admin memilih 4 orang dan 2 di antaranya memiliki catatan kehadiran, lalu memilih "Hapus orang"
- **THEN** dialog menyebut 2 orang memiliki riwayat yang akan ikut terhapus dan tombol hapus baru aktif setelah admin mengetik "HAPUS"

#### Scenario: Hanya admin
- **WHEN** klien anonim memanggil fungsi aksi massal
- **THEN** server menolak permintaan tersebut

### Requirement: Pagination daftar anggota admin
Daftar di tab Anggota kategori dan menu Anggota SHALL dibagi per halaman dengan pilihan 10, 25, atau 50 nama per halaman (default 25), beserta navigasi halaman sebelumnya/berikutnya dan keterangan posisi (mis. "26–50 dari 120"). Pilihan jumlah per halaman SHALL diingat di perangkat admin. Pencarian SHALL mencari di seluruh data, bukan hanya halaman yang tampil, dan mengubah kata pencarian atau jumlah per halaman SHALL kembali ke halaman 1. Pilihan kotak centang SHALL tetap tersimpan saat berpindah halaman.

#### Scenario: Ganti jumlah per halaman
- **WHEN** kategori memiliki 120 anggota dan admin memilih 50 per halaman
- **THEN** daftar menampilkan 50 nama, keterangan "1–50 dari 120", dan 3 halaman

#### Scenario: Pencarian lintas halaman
- **WHEN** admin berada di halaman 3 lalu mengetik nama yang ada di halaman 1
- **THEN** daftar kembali ke halaman 1 dan menampilkan nama tersebut

#### Scenario: Pilihan tetap saat pindah halaman
- **WHEN** admin mencentang 3 nama di halaman 1 lalu pindah ke halaman 2 dan mencentang 2 nama
- **THEN** bilah aksi menampilkan "5 dipilih"

### Requirement: Filter kategori di menu Anggota
Menu Anggota (semua orang) SHALL menyediakan filter kategori dengan pilihan "Semua kategori" (default), setiap kategori (kategori nonaktif ditandai), dan "Tidak di kategori mana pun". Filter SHALL dapat digabung dengan pencarian nama, dan "Pilih semua", aksi massal, serta pagination SHALL berlaku pada hasil yang sudah difilter. Pilihan filter SHALL tersimpan di alamat halaman.

#### Scenario: Filter satu kategori
- **WHEN** admin memilih filter "Kajian Ahad"
- **THEN** daftar hanya menampilkan orang yang menjadi anggota "Kajian Ahad", termasuk yang juga tergabung di kategori lain

#### Scenario: Orang tanpa kategori
- **WHEN** admin memilih "Tidak di kategori mana pun"
- **THEN** daftar hanya menampilkan orang yang tidak tergabung di kategori mana pun

#### Scenario: Filter digabung pencarian dan pilih semua
- **WHEN** admin memilih filter "Kelas A", mengetik "Fa", lalu menekan "Pilih semua"
- **THEN** hanya anggota "Kelas A" yang namanya mengandung "Fa" yang terpilih

