# Spec Delta

## Purpose

Memungkinkan admin membuat dan mengelola kategori/grup kehadiran secara dinamis, termasuk mengatur PIN per kategori yang bisa dinyalakan atau dimatikan.

## ADDED Requirements

### Requirement: CRUD kategori
Admin SHALL dapat membuat, melihat, mengubah nama, dan menghapus kategori. Setiap kategori SHALL memiliki nama unik dan slug URL unik yang diturunkan dari nama.

#### Scenario: Membuat kategori
- **WHEN** admin membuat kategori bernama "Kelas A"
- **THEN** kategori tersimpan dengan slug `kelas-a`, muncul di beranda publik, dan otomatis memiliki satu sesi aktif serta status bawaan

#### Scenario: Nama duplikat
- **WHEN** admin membuat kategori dengan nama yang sudah dipakai kategori lain
- **THEN** sistem menolak dan menampilkan pesan bahwa nama sudah dipakai

#### Scenario: Mengubah nama
- **WHEN** admin mengubah nama kategori "Kelas A" menjadi "Kelas 1A"
- **THEN** nama baru tampil di semua halaman dan riwayat kehadiran tetap utuh

#### Scenario: Menghapus kategori
- **WHEN** admin menghapus kategori dan mengonfirmasi dengan mengetik nama kategori
- **THEN** kategori beserta status, sesi, keanggotaan, dan catatan kehadirannya terhapus, sedangkan data orang (anggota) yang juga tergabung di kategori lain tetap ada

### Requirement: Pengaturan PIN per kategori
Admin SHALL dapat menyalakan atau mematikan PIN untuk setiap kategori secara terpisah, dan mengatur atau mengganti PIN berupa tepat 4 digit angka. Admin SHALL dapat melihat PIN yang sedang aktif melalui tombol mata; PIN tersembunyi secara default. PIN SHALL hanya dapat dibaca oleh admin yang login dan SHALL NOT pernah dikirim ke klien publik.

#### Scenario: Menyalakan PIN
- **WHEN** admin menyalakan PIN untuk "Kelas A" dan mengisi PIN "1234"
- **THEN** membuka "Kelas A" di halaman publik mensyaratkan PIN tersebut

#### Scenario: PIN bukan 4 digit
- **WHEN** admin menyalakan PIN dengan PIN kosong, bukan angka, atau panjangnya selain 4 digit (mis. "123" atau "12345")
- **THEN** sistem menolak penyimpanan dan menampilkan pesan validasi

#### Scenario: Melihat PIN
- **WHEN** admin membuka pengaturan kategori ber-PIN dan menekan tombol mata
- **THEN** PIN yang sedang aktif tampil; menekan tombol mata lagi menyembunyikannya

#### Scenario: Mematikan PIN
- **WHEN** admin mematikan PIN untuk "Kelas B"
- **THEN** pengguna dapat membuka "Kelas B" dan mengisi kehadiran tanpa PIN

#### Scenario: PIN tidak bocor
- **WHEN** klien publik (tanpa login) membaca data kategori
- **THEN** respons hanya memuat apakah PIN aktif, tanpa nilai PIN

### Requirement: Aktif/nonaktif kategori
Admin SHALL dapat menonaktifkan dan mengaktifkan kembali sebuah kategori. Kategori baru SHALL aktif secara default. Kategori nonaktif SHALL NOT tampil di beranda publik, SHALL NOT dapat dibuka lewat halaman kategori publik, dan server SHALL menolak pengisian kehadiran untuknya. Menonaktifkan kategori SHALL NOT menghapus atau mengubah anggota, status, sesi, maupun catatan kehadirannya, dan kategori nonaktif SHALL tetap tampil di panel admin dengan penanda "Nonaktif".

#### Scenario: Menonaktifkan kategori
- **WHEN** admin menonaktifkan kategori "Desaan CNB"
- **THEN** kartu "Desaan CNB" hilang dari beranda publik, dan kategori tetap tampil di daftar kategori admin dengan penanda "Nonaktif"

#### Scenario: Membuka link kategori nonaktif
- **WHEN** pengunjung membuka `/k/desaan-cnb` saat kategori itu nonaktif
- **THEN** sistem menampilkan "Kategori tidak ditemukan"

#### Scenario: Penulisan ke kategori nonaktif
- **WHEN** klien anonim memanggil fungsi penyimpanan kehadiran untuk kategori nonaktif
- **THEN** server menolak penulisan tersebut

#### Scenario: Mengaktifkan kembali
- **WHEN** admin mengaktifkan kembali "Desaan CNB"
- **THEN** kartu kategori tampil lagi di beranda dengan anggota, status, dan kehadiran sesi aktif yang sama seperti sebelum dinonaktifkan

#### Scenario: Kategori nonaktif tidak bocor lewat API
- **WHEN** klien anonim membaca tabel kategori atau ringkasan kategori secara langsung
- **THEN** kategori nonaktif tidak termasuk dalam hasilnya

