# Spec Delta

## ADDED Requirements

### Requirement: Peserta sesi
Peserta sebuah sesi SHALL dihitung otomatis dari wilayah dan kriteria kegiatannya, memakai tanggal sesi untuk menghitung umur dan untuk mengecualikan jamaah yang nonaktif sejak tanggal itu. Selama sesi berjalan, peserta SHALL mengikuti data jamaah terkini (termasuk jamaah baru, jamaah yang baru diterima pindah, dan perubahan kriteria). Saat sesi selesai (manual maupun otomatis), daftar peserta SHALL dibekukan beserta kelompok asal tiap peserta pada saat itu, dan status otomatis (mis. Alpa) SHALL diterapkan ke peserta yang belum mengisi. Sesi yang sudah selesai SHALL NOT berubah pesertanya karena perpindahan, penonaktifan, perubahan umur, status nikah, maupun kriteria. Server SHALL menolak pengisian untuk jamaah yang bukan peserta sesi berjalan.

#### Scenario: Jamaah baru saat sesi berjalan
- **WHEN** admin Kelompok menambah jamaah berumur 17 tahun saat sesi "Remaja" (16–19) sedang berjalan
- **THEN** jamaah itu langsung muncul di daftar pengisian sesi tersebut

#### Scenario: Peserta dibekukan
- **WHEN** sesi "Remaja" 5 Oktober 2026 selesai lalu Budi pindah ke Kelompok Citra
- **THEN** laporan sesi 5 Oktober tetap mencantumkan Budi dengan asal Kelompok Baitul Ilmi

#### Scenario: Bukan peserta
- **WHEN** klien mencoba mengisi status untuk jamaah berumur 30 tahun di sesi "Remaja"
- **THEN** server menolak penyimpanan
