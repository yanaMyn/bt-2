# Spec Delta

## MODIFIED Requirements

### Requirement: CRUD kategori
Admin SHALL dapat membuat, melihat, mengubah nama, dan menghapus kategori. Setiap kategori SHALL memiliki nama unik dan slug URL unik yang diturunkan dari nama. Kategori baru SHALL memiliki status bawaan tetapi belum memiliki sesi; admin menjadwalkan sesi berjam melalui tab Sesi.

#### Scenario: Membuat kategori
- **WHEN** admin membuat kategori bernama "Kelas A"
- **THEN** kategori tersimpan dengan slug `kelas-a`, muncul di beranda publik dengan keterangan "Belum ada jadwal sesi", memiliki status bawaan, dan belum memiliki sesi

#### Scenario: Nama duplikat
- **WHEN** admin membuat kategori dengan nama yang sudah dipakai kategori lain
- **THEN** sistem menolak dan menampilkan pesan bahwa nama sudah dipakai

#### Scenario: Mengubah nama
- **WHEN** admin mengubah nama kategori "Kelas A" menjadi "Kelas 1A"
- **THEN** nama baru tampil di semua halaman dan riwayat kehadiran tetap utuh

#### Scenario: Menghapus kategori
- **WHEN** admin menghapus kategori dan mengonfirmasi dengan mengetik nama kategori
- **THEN** kategori beserta status, sesi, keanggotaan, dan catatan kehadirannya terhapus, sedangkan data orang (anggota) yang juga tergabung di kategori lain tetap ada
