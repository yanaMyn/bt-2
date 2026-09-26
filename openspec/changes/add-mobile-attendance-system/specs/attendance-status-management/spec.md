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
