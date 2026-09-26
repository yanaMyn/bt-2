# Spec Delta

## Purpose

Memungkinkan setiap kategori memiliki daftar status kehadiran sendiri yang dapat dikelola admin, termasuk penanda status mana yang dihitung sebagai hadir untuk perhitungan persentase.

## ADDED Requirements

### Requirement: Status bawaan saat kategori dibuat
Sistem SHALL membuat empat status bawaan untuk setiap kategori baru: "Hadir" (hijau, dihitung hadir), "Izin" (kuning), "Sakit" (biru), dan "Alpa" (merah), dengan urutan tersebut.

#### Scenario: Kategori baru langsung siap dipakai
- **WHEN** admin membuat kategori baru
- **THEN** kategori itu langsung memiliki status Hadir, Izin, Sakit, Alpa dan hanya "Hadir" yang ditandai dihitung hadir

### Requirement: CRUD status per kategori
Admin SHALL dapat menambah, mengubah (label, warna, urutan, flag dihitung hadir), dan menghapus status di dalam satu kategori. Label status SHALL unik di antara status aktif dalam kategori yang sama. Perubahan status di satu kategori SHALL NOT memengaruhi kategori lain.

#### Scenario: Menambah status
- **WHEN** admin menambah status "Doa" berwarna ungu di kategori "Kajian"
- **THEN** "Doa" muncul sebagai pilihan di bottom sheet kategori "Kajian" saja

#### Scenario: Mengubah flag dihitung hadir
- **WHEN** admin menandai status "Izin" sebagai dihitung hadir
- **THEN** persentase hadir kategori tersebut dihitung ulang dengan memasukkan anggota berstatus "Izin"

#### Scenario: Mengubah urutan
- **WHEN** admin memindahkan "Sakit" ke urutan pertama
- **THEN** bottom sheet status menampilkan "Sakit" di posisi teratas

#### Scenario: Label duplikat
- **WHEN** admin menambah status berlabel sama dengan status aktif lain di kategori yang sama
- **THEN** sistem menolak dan menampilkan pesan validasi

### Requirement: Status otomatis saat sesi diakhiri
Setiap kategori SHALL memiliki pengaturan "status otomatis saat sesi diakhiri" yang berisi salah satu status aktif kategori itu atau "Tidak ada". Kategori baru SHALL memakai status bawaan "Alpa". Hanya status aktif milik kategori yang sama yang boleh dipilih. Bila status yang dipilih diarsipkan atau dihapus, pengaturan SHALL kembali menjadi "Tidak ada".

#### Scenario: Default kategori baru
- **WHEN** admin membuat kategori baru
- **THEN** status otomatis saat sesi diakhiri kategori itu adalah "Alpa"

#### Scenario: Mengganti status otomatis
- **WHEN** admin memilih "Izin" sebagai status otomatis saat sesi diakhiri di kategori "Kajian"
- **THEN** saat sesi "Kajian" berikutnya diakhiri, anggota yang belum mengisi dicatat "Izin"

#### Scenario: Status otomatis diarsipkan
- **WHEN** admin menghapus status "Alpa" yang sudah terpakai dan sedang menjadi status otomatis saat sesi diakhiri
- **THEN** "Alpa" diarsipkan dan status otomatis saat sesi diakhiri menjadi "Tidak ada"

#### Scenario: Status kategori lain ditolak
- **WHEN** klien mencoba menjadikan status milik kategori lain sebagai status otomatis saat sesi diakhiri
- **THEN** server menolak perubahan tersebut

### Requirement: Arsip status yang sudah dipakai
Saat admin menghapus status yang sudah pernah dipakai di catatan kehadiran mana pun, sistem SHALL mengarsipkannya alih-alih menghapus permanen. Status terarsip SHALL NOT muncul sebagai pilihan pengisian, tetapi SHALL tetap tampil di daftar dan laporan untuk catatan yang memakainya. Status yang belum pernah dipakai SHALL dihapus permanen.

#### Scenario: Hapus status belum terpakai
- **WHEN** admin menghapus status yang belum pernah dipakai
- **THEN** status terhapus permanen

#### Scenario: Hapus status terpakai
- **WHEN** admin menghapus status "Doa" yang tercatat di sesi lama
- **THEN** "Doa" hilang dari pilihan pengisian, dan laporan sesi lama tetap menampilkan "Doa"

#### Scenario: Minimal satu status aktif
- **WHEN** admin mencoba menghapus atau mengarsipkan status aktif terakhir di sebuah kategori
- **THEN** sistem menolak karena kategori harus memiliki minimal satu status aktif
