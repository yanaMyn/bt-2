# Spec Delta

## MODIFIED Requirements

### Requirement: Beranda daftar kategori
Halaman `/` SHALL menampilkan semua kategori aktif sebagai kartu yang dapat di-tap. Bila kategori memiliki sesi berjalan, kartu SHALL berisi nama kategori, label dan jam sesi berjalan, persentase hadir, dan jumlah hadir/total anggota. Bila tidak, kartu SHALL menampilkan kapan absen berikutnya dibuka atau "Belum ada jadwal sesi", tanpa persentase. Halaman ini SHALL dapat diakses tanpa login dan SHALL memperbarui keadaan kartu tepat saat sebuah sesi mulai atau selesai tanpa pengguna memuat ulang halaman.

#### Scenario: Menampilkan kategori
- **WHEN** pengunjung membuka `/` saat sesi "Kelas A" 19.30–21.00 sedang berjalan
- **THEN** kartu "Kelas A" menampilkan nama, "19.30–21.00", persentase hadir, dan teks seperti "12/15 hadir"

#### Scenario: Membuka kategori
- **WHEN** pengunjung men-tap kartu "Kelas A"
- **THEN** sistem membuka `/k/kelas-a`

#### Scenario: Kategori tanpa sesi berjalan
- **WHEN** sebuah kategori tidak memiliki sesi berjalan dan sesi berikutnya dijadwalkan Kamis, 8 Oktober 2026 pukul 19.30
- **THEN** kartunya tampil dengan tulisan "Absen dibuka Kamis, 8 Oktober 2026 pukul 19.30" tanpa persentase

#### Scenario: Kartu berubah saat sesi mulai
- **WHEN** beranda sedang terbuka dan jam mencapai 19.30, jam mulai sesi "Kelas A"
- **THEN** kartu "Kelas A" berubah menampilkan sesi berjalan dan persentasenya tanpa memuat ulang halaman

#### Scenario: Belum ada kategori
- **WHEN** belum ada kategori sama sekali
- **THEN** beranda menampilkan pesan kosong yang ramah

### Requirement: Halaman daftar anggota kategori
Halaman `/k/:slug` SHALL menampilkan label, jam, dan catatan sesi berjalan, persentase hadir keseluruhan serta per jenis kelamin (L dan P, masing-masing dengan jumlah hadir/total), kolom pencarian nama, dan daftar anggota kategori diurutkan berdasarkan nama. Setiap baris anggota SHALL menampilkan nama dan status sesi berjalannya berupa label berwarna, atau penanda "Belum" bila belum diisi. Bila tidak ada sesi berjalan, halaman SHALL menampilkan kapan absen berikutnya dibuka atau "Belum ada jadwal sesi" tanpa daftar pengisian, dan SHALL beralih otomatis ke daftar pengisian tepat saat sesi berikutnya mulai.

#### Scenario: Menampilkan daftar
- **WHEN** pengunjung membuka `/k/kelas-a` saat sesi sedang berjalan
- **THEN** sistem menampilkan label dan jam sesi, persentase keseluruhan, L, dan P, serta daftar anggota beserta statusnya

#### Scenario: Menunggu jam mulai
- **WHEN** pengunjung membuka `/k/kelas-a` pukul 19.00 dan sesi berikutnya mulai pukul 19.30 hari itu
- **THEN** halaman menampilkan "Absen dibuka <hari, tanggal> pukul 19.30" tanpa daftar pengisian, lalu menampilkan daftar pengisian pada pukul 19.30 tanpa dimuat ulang

#### Scenario: Slug tidak ditemukan
- **WHEN** pengunjung membuka slug kategori yang tidak ada
- **THEN** sistem menampilkan pesan "Kategori tidak ditemukan" dan tautan kembali ke beranda
