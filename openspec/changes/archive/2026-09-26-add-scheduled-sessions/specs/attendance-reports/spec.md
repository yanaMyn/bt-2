# Spec Delta

## MODIFIED Requirements

### Requirement: Pemilihan tanggal laporan dengan kalender
Setiap tab laporan (Rekap, Per anggota, Grafik) SHALL memakai pemilih kalender dengan dua mode: **Tanggal** (satu hari) dan **Rentang** (tanggal awal sampai tanggal akhir, inklusif), serta pilihan cepat "Hari ini", "Bulan ini", "Bulan lalu", dan "Semua". Sebuah sesi termasuk dalam pilihan bila tanggal sesinya berada di dalam tanggal/rentang tersebut dan sesi itu sudah mulai (berjalan atau selesai); sesi yang masih dijadwalkan SHALL NOT termasuk dalam rekap, rekap per anggota, grafik, maupun daftar tanggal sesi untuk pilihan "Semua" dan sesi terdekat. Bila tanggal awal lebih besar dari tanggal akhir, sistem SHALL menukarnya. Pilihan tanggal SHALL tersimpan di alamat halaman sehingga laporan yang sama dapat dibuka ulang.

#### Scenario: Satu tanggal
- **WHEN** admin memilih mode Tanggal dan tanggal 26 September 2026
- **THEN** laporan hanya mencakup sesi bertanggal 26 September 2026 yang sudah mulai

#### Scenario: Rentang
- **WHEN** admin memilih mode Rentang dari 1 sampai 30 September 2026
- **THEN** laporan mencakup semua sesi bertanggal 1–30 September 2026 yang sudah mulai, termasuk sesi bertanggal 30 September yang baru ditutup pada bulan Oktober

#### Scenario: Sesi dijadwalkan diabaikan
- **WHEN** pada 12 Oktober 2026 admin membuka rekap "Bulan ini" untuk kategori yang memiliki 4 sesi selesai dan 5 sesi masih dijadwalkan di bulan Oktober
- **THEN** rekap hanya mencakup 4 sesi, dan persentase tidak ikut dihitung dari 5 sesi yang belum mulai

#### Scenario: Pilihan cepat
- **WHEN** admin menekan "Bulan ini" pada tanggal 26 September 2026
- **THEN** rentang menjadi 1 sampai 30 September 2026
