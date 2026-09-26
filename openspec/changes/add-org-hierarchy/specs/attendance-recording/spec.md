# Spec Delta

## ADDED Requirements

### Requirement: Pilih desa dan kelompok
Halaman `/` SHALL meminta pengunjung memilih Desa lalu Kelompok (tanpa login), lalu membuka halaman kelompok tersebut. Kelompok yang dipilih SHALL diingat di perangkat sehingga kunjungan berikutnya ke `/` langsung membuka halaman kelompok itu, dengan tombol "Ganti kelompok" untuk memilih ulang. Bila penyimpanan perangkat tidak tersedia, pengunjung cukup memilih ulang tanpa error.

#### Scenario: Kunjungan pertama
- **WHEN** pengunjung membuka `/` untuk pertama kali
- **THEN** sistem menampilkan daftar Desa, lalu daftar Kelompok di Desa yang dipilih, lalu membuka halaman kelompok yang dipilih

#### Scenario: Kunjungan berikutnya
- **WHEN** pengunjung yang sebelumnya memilih Kelompok Baitul Ilmi membuka `/` lagi
- **THEN** sistem langsung membuka halaman Kelompok Baitul Ilmi

#### Scenario: Ganti kelompok
- **WHEN** pengunjung menekan "Ganti kelompok"
- **THEN** sistem kembali ke pilihan Desa dan Kelompok

#### Scenario: Belum ada struktur
- **WHEN** belum ada Desa atau Kelompok sama sekali
- **THEN** beranda menampilkan pesan kosong yang ramah

### Requirement: Halaman kelompok
Halaman kelompok SHALL menampilkan kegiatan aktif yang mengikutkan kelompok itu, dengan filter **Kelompok** (kegiatan milik kelompok itu, default), **Desa** (kegiatan milik Desanya yang wilayahnya mencakup kelompok itu), dan **Daerah** (kegiatan milik Daerah yang wilayahnya mencakup Desanya). Kegiatan dengan sesi berjalan SHALL tampil paling atas beserta jam dan persentase hadir; kegiatan lain diurutkan dari jadwal terdekat dengan keterangan "Absen dibuka <hari, tanggal> pukul <jam>" atau "Belum ada jadwal sesi". Persentase pada kartu kegiatan Desa/Daerah SHALL dihitung untuk peserta dari kelompok itu. Kartu SHALL memperbarui keadaannya tepat saat sesi mulai atau selesai tanpa memuat ulang halaman.

#### Scenario: Filter default kelompok
- **WHEN** pengunjung membuka halaman Kelompok Baitul Ilmi saat sesi "Remaja" sedang berjalan
- **THEN** kartu "Remaja" tampil paling atas dengan jam dan persentase hadir, diikuti kegiatan kelompok lainnya

#### Scenario: Filter Desa
- **WHEN** pengunjung memilih filter Desa di halaman Kelompok Baitul Ilmi
- **THEN** hanya kegiatan milik Desa CNT yang wilayahnya mencakup Baitul Ilmi yang tampil, dengan persentase hadir peserta dari Baitul Ilmi

#### Scenario: Kegiatan tidak mencakup kelompok
- **WHEN** kegiatan Desa CNT hanya mencakup Kelompok Citra
- **THEN** kegiatan itu tidak tampil di halaman Kelompok Baitul Ilmi

## MODIFIED Requirements

### Requirement: Halaman daftar anggota kategori
Halaman `/k/:slug` (halaman kegiatan) SHALL menampilkan nama kegiatan dan unit pemiliknya, label, jam, dan catatan sesi berjalan, persentase hadir keseluruhan serta per jenis kelamin (L dan P, masing-masing dengan jumlah hadir/total), kolom pencarian nama, dan daftar peserta sesi berjalan diurutkan berdasarkan nama. Setiap baris peserta SHALL menampilkan nama dan status sesi berjalannya berupa label berwarna, atau penanda "Belum" bila belum diisi. Untuk kegiatan milik Desa atau Daerah, halaman SHALL menyediakan filter kelompok dengan nilai bawaan kelompok yang diingat di perangkat (bila termasuk wilayah kegiatan) dan pilihan "Semua kelompok"; persentase mengikuti filter yang dipilih, dan setiap baris menampilkan nama kelompok asal saat "Semua kelompok" dipilih. Bila tidak ada sesi berjalan, halaman SHALL menampilkan kapan absen berikutnya dibuka atau "Belum ada jadwal sesi" tanpa daftar pengisian, dan SHALL beralih otomatis ke daftar pengisian tepat saat sesi berikutnya mulai.

#### Scenario: Menampilkan daftar
- **WHEN** pengunjung membuka `/k/remaja-baitul-ilmi` saat sesi sedang berjalan
- **THEN** sistem menampilkan label dan jam sesi, persentase keseluruhan, L, dan P, serta daftar peserta beserta statusnya

#### Scenario: Menunggu jam mulai
- **WHEN** pengunjung membuka halaman kegiatan pukul 19.00 dan sesi berikutnya mulai pukul 19.30 hari itu
- **THEN** halaman menampilkan "Absen dibuka <hari, tanggal> pukul 19.30" tanpa daftar pengisian, lalu menampilkan daftar pengisian pada pukul 19.30 tanpa dimuat ulang

#### Scenario: Slug tidak ditemukan
- **WHEN** pengunjung membuka slug kegiatan yang tidak ada
- **THEN** sistem menampilkan pesan "Kegiatan tidak ditemukan" dan tautan kembali ke beranda

#### Scenario: Kegiatan Desa difilter ke kelompok sendiri
- **WHEN** pengunjung yang kelompoknya Baitul Ilmi membuka kegiatan "Desaan CNT" yang mencakup Baitul Ilmi dan Citra
- **THEN** daftar bawaan hanya berisi peserta dari Baitul Ilmi, dan memilih "Semua kelompok" menampilkan peserta kedua kelompok beserta nama kelompoknya

## REMOVED Requirements

### Requirement: Beranda daftar kategori
**Reason**: Dengan banyak kegiatan per kelompok, desa, dan daerah, daftar semua kegiatan di beranda membingungkan; digantikan "Pilih desa dan kelompok" dan "Halaman kelompok".
**Migration**: Beranda kini memilih Desa lalu Kelompok; kegiatan tampil di halaman kelompok dengan filter Kelompok/Desa/Daerah. Link `/k/<slug>` kegiatan tetap bisa dibagikan langsung.
