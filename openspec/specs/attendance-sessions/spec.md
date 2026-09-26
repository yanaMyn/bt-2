# attendance-sessions Specification

## Purpose

Mengelompokkan kehadiran per kategori ke dalam sesi bertanggal sehingga admin dapat mengakhiri sesi dan memulai sesi baru tanpa kehilangan riwayat yang dibutuhkan untuk laporan.

## Requirements

### Requirement: Tanggal dan catatan sesi
Setiap sesi SHALL memiliki tanggal sesi (hari, tanggal, bulan, tahun) yang dipilih admin melalui kalender, dan catatan opsional berupa teks bebas maksimal 200 karakter. Label sesi SHALL dibentuk otomatis dari tanggal sesi dalam bahasa Indonesia (mis. "Sabtu, 26 September 2026") dan SHALL NOT dapat diketik bebas. Catatan SHALL tampil bersama label sesi di riwayat sesi, laporan, ekspor, dan halaman kategori publik. Beberapa sesi dalam satu kategori boleh memiliki tanggal yang sama.

#### Scenario: Label dari tanggal
- **WHEN** admin memilih tanggal 26 September 2026 untuk sebuah sesi
- **THEN** label sesi menjadi "Sabtu, 26 September 2026"

#### Scenario: Catatan terlalu panjang
- **WHEN** admin mengisi catatan lebih dari 200 karakter
- **THEN** sistem menolak penyimpanan dan menampilkan pesan validasi

#### Scenario: Catatan tampil di halaman publik
- **WHEN** sesi aktif "Kelas A" memiliki catatan "Kajian tafsir, pemateri Ust. Ahmad"
- **THEN** halaman kategori publik menampilkan label sesi beserta catatan tersebut

### Requirement: Paling banyak satu sesi aktif per kategori
Setiap kategori SHALL memiliki paling banyak satu sesi aktif (sesi berjalan). Semua pengisian kehadiran publik SHALL tercatat pada sesi aktif kategori tersebut. Setiap anggota SHALL memiliki paling banyak satu status per sesi. Bila kategori tidak memiliki sesi aktif, pengisian kehadiran SHALL ditolak server, halaman kategori publik SHALL menampilkan "Sesi sudah diakhiri. Tunggu sesi berikutnya dari pengurus." tanpa daftar pengisian, dan kartu kategori di beranda SHALL menampilkan "Belum ada sesi berjalan" tanpa persentase.

#### Scenario: Kategori baru
- **WHEN** kategori baru dibuat
- **THEN** sebuah sesi aktif dibuat otomatis dengan tanggal sesi hari itu (WIB) dan tanpa catatan

#### Scenario: Pengisian tercatat di sesi aktif
- **WHEN** pengguna mengisi status Budi di "Kelas A"
- **THEN** status tercatat pada sesi aktif "Kelas A"

#### Scenario: Tidak ada sesi berjalan
- **WHEN** sesi "Kelas A" sudah diakhiri dan belum ada sesi baru
- **THEN** halaman publik "Kelas A" menampilkan pesan sesi sudah diakhiri, kartu beranda menampilkan "Belum ada sesi berjalan", dan server menolak pengisian kehadiran untuk "Kelas A"

### Requirement: Akhiri sesi
Admin SHALL dapat mengakhiri sesi aktif sebuah kategori melalui tombol "Akhiri sesi" yang berada di baris sesi aktif pada riwayat sesi, bersebelahan dengan "Ubah tanggal/catatan". Mengakhiri sesi SHALL menutup sesi (mencatat waktu penutupan) tanpa membuat sesi baru. Anggota sesi yang belum memiliki status SHALL otomatis dicatat dengan status otomatis saat sesi diakhiri kategori tersebut (lihat pengaturan status); bila kategori tidak memilikinya, mereka tetap "Belum". Dialog konfirmasi SHALL menyebut jumlah catatan yang sudah ada serta berapa anggota yang akan dicatat otomatis dan dengan status apa. Mengakhiri sesi SHALL NOT menghapus catatan kehadiran dan SHALL NOT memengaruhi kategori lain.

#### Scenario: Mengakhiri sesi
- **WHEN** admin menekan "Akhiri sesi" pada sesi aktif "Kelas A" dan mengonfirmasi
- **THEN** sesi tersebut tertutup dan tetap tersedia di laporan, dan "Kelas A" tidak memiliki sesi berjalan

#### Scenario: Konfirmasi mengakhiri sesi
- **WHEN** admin menekan "Akhiri sesi" pada kategori berisi 12 anggota yang 9 di antaranya sudah mengisi, dengan status otomatis "Alpa"
- **THEN** dialog konfirmasi menyebut 9 catatan kehadiran dan "3 anggota yang belum mengisi akan dicatat Alpa"

#### Scenario: Anggota belum mengisi dicatat otomatis
- **WHEN** admin mengakhiri sesi kategori yang status otomatisnya "Alpa" dan Budi belum mengisi
- **THEN** di sesi yang diakhiri Budi tercatat "Alpa" (bukan "Belum")

#### Scenario: Tanpa status otomatis
- **WHEN** admin mengakhiri sesi kategori yang status otomatisnya "Tidak ada"
- **THEN** anggota yang belum mengisi tetap "Belum" di sesi tersebut

#### Scenario: Kategori lain tidak terpengaruh
- **WHEN** admin mengakhiri sesi "Kelas A"
- **THEN** status kehadiran dan sesi "Kelas B" tidak berubah

### Requirement: Buat sesi baru
Admin SHALL dapat membuat sesi baru melalui tombol "Buat sesi baru" yang terpisah dari riwayat sesi, dengan memilih tanggal sesi melalui kalender (default: hari ini, WIB) dan catatan opsional. Tombol ini SHALL hanya dapat dipakai bila kategori tidak memiliki sesi aktif; bila masih ada sesi aktif, sistem SHALL menampilkan petunjuk untuk mengakhiri sesi aktif terlebih dahulu dan server SHALL menolak pembuatan sesi kedua.

#### Scenario: Membuat sesi baru
- **WHEN** "Kelas A" tidak memiliki sesi berjalan dan admin membuat sesi baru bertanggal 3 Oktober 2026 dengan catatan "Pekan 1"
- **THEN** sesi aktif baru berlabel "Sabtu, 3 Oktober 2026" dibuat, semua anggota tampil "Belum" di halaman publik, dan persentase menjadi 0%

#### Scenario: Masih ada sesi aktif
- **WHEN** "Kelas A" masih memiliki sesi aktif
- **THEN** tombol "Buat sesi baru" tidak dapat dipakai dan tampil petunjuk "Akhiri sesi aktif dulu"

### Requirement: Sesi tertutup bersifat hanya-baca
Catatan kehadiran pada sesi yang sudah ditutup SHALL NOT dapat diubah melalui alur publik.

#### Scenario: Pengisian setelah sesi diakhiri
- **WHEN** pengguna yang membuka halaman sebelum sesi diakhiri men-tap status setelah sesi diakhiri
- **THEN** server menolak penyimpanan, sesi yang sudah ditutup tidak berubah, dan halaman menampilkan pesan sesi sudah diakhiri

### Requirement: Riwayat sesi
Admin SHALL dapat melihat daftar sesi sebuah kategori (label tanggal, catatan, waktu mulai, waktu tutup, persentase hadir) dan mengubah tanggal (lewat kalender) serta catatan sesi mana pun.

#### Scenario: Melihat riwayat
- **WHEN** admin membuka riwayat sesi "Kelas A"
- **THEN** sistem menampilkan semua sesi dari yang terbaru, dengan sesi aktif ditandai

#### Scenario: Mengubah tanggal sesi
- **WHEN** admin mengubah tanggal sesi lama dari 30 September menjadi 1 Oktober 2026
- **THEN** label sesi berubah menjadi "Kamis, 1 Oktober 2026" dan sesi itu masuk rekap bulan Oktober 2026
