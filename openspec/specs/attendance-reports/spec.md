# attendance-reports Specification

## Purpose

Memberi admin laporan kehadiran berdasarkan tanggal atau rentang tanggal yang dipilih dari kalender, rekap per anggota, dan grafik perbandingan antar kategori, yang dapat diekspor ke `.xlsx` untuk diarsipkan atau dibagikan.

## Requirements

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

### Requirement: Rekap berdasarkan tanggal atau rentang
Admin SHALL dapat memilih sebuah kategori dan tanggal/rentang, lalu melihat rekap gabungan semua sesi kategori itu dalam pilihan tersebut: daftar sesi yang tercakup beserta catatannya, tabel jumlah isian per status (termasuk status terarsip yang terpakai dan baris "Belum") dipecah L, P, dan total, persentase hadir (jumlah isian berstatus dihitung hadir dibagi jumlah anggota-sesi), serta tabel per anggota. Bila pilihan mencakup tepat satu sesi, sistem SHALL juga menampilkan daftar anggota beserta status masing-masing pada sesi itu. Default pilihan adalah tanggal sesi terbaru kategori tersebut. Bila tidak ada sesi dalam pilihan, sistem SHALL menampilkan pesan dan tanggal-tanggal sesi terdekat yang dapat langsung dipilih.

#### Scenario: Satu sesi
- **WHEN** admin membuka rekap "Kelas A" tanggal 26 September 2026 yang memiliki satu sesi
- **THEN** sistem menampilkan jumlah per status untuk L, P, dan total, persentase hadir, serta daftar anggota beserta statusnya

#### Scenario: Rentang dengan beberapa sesi
- **WHEN** kategori "Kelas A" berisi 10 anggota dan memiliki 4 sesi bertanggal September 2026 dengan total 30 isian "Hadir", dan admin memilih rentang 1–30 September 2026
- **THEN** rekap menampilkan 4 sesi, "Hadir" berjumlah 30, persentase hadir 75%, dan tabel per anggota

#### Scenario: Sesi dengan status terarsip
- **WHEN** sesi lama memuat catatan berstatus "Doa" yang kini diarsipkan
- **THEN** rekap tetap menampilkan baris "Doa" dengan jumlahnya

#### Scenario: Anggota yang sudah dikeluarkan
- **WHEN** Budi dikeluarkan dari "Kelas A" setelah sesinya ditutup
- **THEN** rekap sesi tersebut tetap menampilkan catatan Budi

#### Scenario: Tidak ada sesi
- **WHEN** admin memilih tanggal yang tidak memiliki sesi
- **THEN** sistem menampilkan "Tidak ada sesi pada tanggal ini" beserta tanggal sesi terdekat sebelum dan sesudahnya yang dapat ditekan untuk dipilih

### Requirement: Rekap per anggota
Admin SHALL dapat memilih sebuah kategori dan tanggal/rentang (default: "Semua"), lalu melihat tabel per anggota berisi jumlah kemunculan tiap status, jumlah sesi tanpa isian ("Belum"), jumlah sesi, dan persentase hadir anggota tersebut (jumlah sesi dengan status dihitung hadir dibagi jumlah sesi dalam pilihan ketika ia menjadi anggota).

#### Scenario: Rekap anggota
- **WHEN** admin membuka rekap anggota "Kelas A" dengan pilihan yang mencakup 9 sesi dan Ahmad tercatat Hadir 8 kali serta Izin 1 kali
- **THEN** baris Ahmad menampilkan Hadir 8, Izin 1, dan persentase 89%

### Requirement: Grafik perbandingan antar kategori
Panel admin SHALL menyediakan grafik batang yang membandingkan persentase hadir antar kategori untuk tanggal/rentang terpilih (default: "Bulan ini"), diurutkan dari tertinggi. Untuk setiap kategori dipakai gabungan semua sesinya dalam pilihan, dengan perhitungan yang sama seperti rekap; setiap batang menampilkan jumlah sesi dan jumlah hadir/total. Kategori yang tidak memiliki sesi dalam pilihan SHALL tetap tercantum dengan keterangan "tidak ada sesi" tanpa batang. Kategori nonaktif SHALL ditandai "Nonaktif". Grafik SHALL NOT tersedia di halaman publik.

#### Scenario: Rentang bulan
- **WHEN** admin membuka grafik dengan rentang 1–30 September 2026
- **THEN** setiap kategori tampil dengan persentase hadir gabungan sesi-sesinya yang bertanggal September 2026, diurutkan dari tertinggi

#### Scenario: Kategori tanpa sesi
- **WHEN** admin memilih satu tanggal dan kategori "Kajian" tidak memiliki sesi pada tanggal itu
- **THEN** "Kajian" tercantum dengan keterangan "tidak ada sesi" di akhir daftar

### Requirement: Ekspor laporan ke xlsx
Tab Rekap dan Per anggota SHALL dapat diekspor menjadi file `.xlsx` yang isinya sama dengan tabel di layar, termasuk catatan sesi, dengan nama file yang memuat nama kategori dan tanggal atau rentang.

#### Scenario: Ekspor rekap satu tanggal
- **WHEN** admin menekan "Ekspor .xlsx" pada rekap "Kelas A" tanggal 26 September 2026
- **THEN** browser mengunduh file seperti `Kelas-A_Sabtu-26-September-2026.xlsx` berisi sheet rekap status (termasuk daftar sesi dan catatannya), sheet rekap per anggota, dan sheet daftar anggota beserta statusnya

#### Scenario: Ekspor rekap rentang
- **WHEN** admin menekan "Ekspor .xlsx" pada rekap "Kelas A" rentang 1–30 September 2026
- **THEN** browser mengunduh file seperti `Kelas-A_1-September-2026-sd-30-September-2026.xlsx` berisi sheet rekap status dan sheet rekap per anggota

#### Scenario: Ekspor rekap anggota
- **WHEN** admin menekan "Ekspor .xlsx" pada tab Per anggota
- **THEN** browser mengunduh file berisi tabel rekap per anggota yang sama dengan tampilan
