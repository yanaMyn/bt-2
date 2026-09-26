# Spec Delta

## Purpose

Memberi admin laporan kehadiran per sesi dan per anggota lintas sesi, yang dapat diekspor ke `.xlsx` untuk diarsipkan atau dibagikan.

## ADDED Requirements

### Requirement: Rekap per sesi
Admin SHALL dapat memilih sebuah kategori dan salah satu sesinya, lalu melihat tabel jumlah anggota per status (termasuk status terarsip yang terpakai dan baris "Belum") yang dipecah per jenis kelamin L, P, dan total, beserta baris persentase hadir. Admin SHALL juga dapat melihat daftar anggota beserta status masing-masing pada sesi tersebut.

#### Scenario: Rekap sesi
- **WHEN** admin membuka laporan "Kelas A" sesi "September 2026"
- **THEN** sistem menampilkan jumlah per status untuk L, P, dan total, serta persentase hadir sesuai aturan perhitungan persentase

#### Scenario: Sesi dengan status terarsip
- **WHEN** sesi lama memuat catatan berstatus "Doa" yang kini diarsipkan
- **THEN** rekap sesi tetap menampilkan baris "Doa" dengan jumlahnya

#### Scenario: Anggota yang sudah dikeluarkan
- **WHEN** Budi dikeluarkan dari "Kelas A" setelah sesi "Agustus 2026" ditutup
- **THEN** rekap sesi "Agustus 2026" tetap menampilkan catatan Budi

### Requirement: Rekap per anggota lintas sesi
Admin SHALL dapat memilih sebuah kategori dan rentang sesi (default: semua sesi), lalu melihat tabel per anggota berisi jumlah kemunculan tiap status, jumlah sesi tanpa isian ("Belum"), dan persentase hadir anggota tersebut (jumlah sesi dengan status dihitung hadir dibagi jumlah sesi dalam rentang ketika ia menjadi anggota).

#### Scenario: Rekap anggota
- **WHEN** admin membuka rekap anggota "Kelas A" untuk 9 sesi dan Ahmad tercatat Hadir 8 kali serta Izin 1 kali
- **THEN** baris Ahmad menampilkan Hadir 8, Izin 1, dan persentase 89%

### Requirement: Rekap per bulan
Admin SHALL dapat memilih sebuah kategori dan satu bulan, lalu melihat rekap gabungan semua sesi kategori itu yang tanggal sesinya berada pada bulan tersebut. Rekap SHALL berisi daftar sesi yang tercakup, tabel jumlah isian per status (termasuk status terarsip yang terpakai dan "Belum") dipecah L, P, dan total, persentase hadir (jumlah isian berstatus dihitung hadir dibagi jumlah anggota-sesi dalam bulan itu), serta tabel per anggota seperti rekap per anggota yang dibatasi pada sesi bulan tersebut. Pilihan bulan SHALL hanya berisi bulan yang memiliki sesi.

#### Scenario: Bulan dengan beberapa sesi
- **WHEN** kategori "Kelas A" berisi 10 anggota dan memiliki 4 sesi bertanggal September 2026, dengan total 30 isian "Hadir"
- **THEN** rekap bulan September 2026 menampilkan 4 sesi, "Hadir" berjumlah 30, dan persentase hadir 75%

#### Scenario: Sesi lintas bulan
- **WHEN** sebuah sesi bertanggal 30 September 2026 baru ditutup (di-reset) pada 2 Oktober 2026
- **THEN** sesi itu dihitung di rekap September 2026, bukan Oktober

### Requirement: Grafik perbandingan antar kategori
Panel admin SHALL menyediakan grafik batang yang membandingkan persentase hadir antar kategori, diurutkan dari tertinggi, dengan dua mode. **Per sesi**: untuk setiap kategori dipakai sesi aktif, atau sesi ke-N sebelum sesi aktif sesuai pilihan admin, yang dihitung mundur per kategori; setiap batang menampilkan label sesi yang dipakai. **Per bulan**: untuk setiap kategori dipakai gabungan semua sesi yang tanggal sesinya berada pada bulan terpilih, dengan perhitungan yang sama seperti rekap per bulan. Kategori yang tidak memiliki sesi untuk pilihan tersebut SHALL tetap tercantum dengan keterangan "tidak ada sesi" tanpa batang. Kategori nonaktif SHALL ditandai "Nonaktif". Grafik SHALL NOT tersedia di halaman publik.

#### Scenario: Per sesi, sesi aktif
- **WHEN** admin membuka grafik mode per sesi dengan pilihan "Sesi aktif"
- **THEN** setiap kategori tampil sebagai batang persentase hadir sesi aktifnya beserta label sesinya, diurutkan dari persentase tertinggi

#### Scenario: Per sesi, sesi sebelumnya
- **WHEN** admin memilih "1 sesi sebelumnya" dan kategori "Kajian" hanya memiliki satu sesi
- **THEN** kategori lain tampil memakai sesi sebelum sesi aktifnya masing-masing, dan "Kajian" tercantum dengan keterangan "tidak ada sesi"

#### Scenario: Per bulan
- **WHEN** admin memilih mode per bulan dan bulan September 2026
- **THEN** setiap kategori tampil dengan persentase hadir gabungan sesi-sesinya yang bertanggal September 2026

### Requirement: Ekspor laporan ke xlsx
Setiap tampilan laporan (rekap sesi, rekap per bulan, dan rekap anggota) SHALL dapat diekspor menjadi file `.xlsx` yang isinya sama dengan tabel di layar, dengan nama file yang memuat nama kategori dan label sesi atau rentang.

#### Scenario: Ekspor rekap sesi
- **WHEN** admin menekan "Ekspor .xlsx" pada rekap "Kelas A" sesi "Sabtu, 26 September 2026"
- **THEN** browser mengunduh file seperti `Kelas-A_Sabtu-26-September-2026.xlsx` berisi sheet rekap status (termasuk catatan sesi) dan sheet daftar anggota beserta statusnya

#### Scenario: Ekspor rekap anggota
- **WHEN** admin menekan "Ekspor .xlsx" pada rekap anggota
- **THEN** browser mengunduh file berisi tabel rekap per anggota yang sama dengan tampilan

#### Scenario: Ekspor rekap per bulan
- **WHEN** admin menekan "Ekspor .xlsx" pada rekap "Kelas A" bulan September 2026
- **THEN** browser mengunduh file seperti `Kelas-A_Bulan-September-2026.xlsx` berisi sheet rekap status dan sheet rekap per anggota

