# attendance-sessions Specification

## Purpose

Mengelompokkan kehadiran per kategori ke dalam sesi bertanggal dan berjam yang dapat dijadwalkan sekaligus, dibuka dan ditutup otomatis sesuai jadwal, tanpa kehilangan riwayat yang dibutuhkan untuk laporan.

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
Setiap kategori SHALL memiliki paling banyak satu sesi berjalan pada satu waktu (lihat keadaan sesi). Semua pengisian kehadiran publik SHALL tercatat pada sesi berjalan kategori tersebut. Setiap anggota SHALL memiliki paling banyak satu status per sesi. Bila kategori tidak memiliki sesi berjalan, pengisian kehadiran SHALL ditolak server. Halaman kategori publik SHALL menampilkan, tanpa daftar pengisian: "Absen dibuka <hari, tanggal> pukul <jam>" bila ada sesi dijadwalkan berikutnya, atau "Belum ada jadwal sesi" bila tidak ada. Kartu kategori di beranda SHALL menampilkan pesan yang sama tanpa persentase.

#### Scenario: Kategori baru
- **WHEN** kategori baru dibuat
- **THEN** kategori belum memiliki sesi, halaman publik menampilkan "Belum ada jadwal sesi", dan admin perlu menjadwalkan sesi

#### Scenario: Pengisian tercatat di sesi aktif
- **WHEN** pengguna mengisi status Budi di "Kelas A" saat sesi 19.30–21.00 sedang berjalan
- **THEN** status tercatat pada sesi berjalan "Kelas A"

#### Scenario: Tidak ada sesi berjalan
- **WHEN** sesi terakhir "Kelas A" sudah selesai dan sesi berikutnya dijadwalkan Kamis, 8 Oktober 2026 pukul 19.30
- **THEN** halaman publik "Kelas A" dan kartu berandanya menampilkan "Absen dibuka Kamis, 8 Oktober 2026 pukul 19.30", dan server menolak pengisian kehadiran untuk "Kelas A"

#### Scenario: Tidak ada jadwal
- **WHEN** "Kelas A" tidak memiliki sesi berjalan maupun sesi dijadwalkan
- **THEN** halaman publik dan kartu beranda menampilkan "Belum ada jadwal sesi"

### Requirement: Akhiri sesi
Admin SHALL dapat mengakhiri sesi berjalan sebuah kategori lebih cepat melalui tombol "Akhiri sesi" yang berada di baris sesi berjalan pada riwayat sesi, bersebelahan dengan "Ubah jadwal/catatan". Mengakhiri sesi SHALL menutup sesi (mencatat waktu penutupan) tanpa membuat sesi baru dan tanpa mengubah sesi dijadwalkan lainnya. Anggota sesi yang belum memiliki status SHALL otomatis dicatat dengan status otomatis saat sesi diakhiri kategori tersebut (lihat pengaturan status); bila kategori tidak memilikinya, mereka tetap "Belum". Dialog konfirmasi SHALL menyebut jumlah catatan yang sudah ada serta berapa anggota yang akan dicatat otomatis dan dengan status apa. Mengakhiri sesi SHALL NOT menghapus catatan kehadiran dan SHALL NOT memengaruhi kategori lain.

#### Scenario: Mengakhiri sesi
- **WHEN** admin menekan "Akhiri sesi" pada sesi berjalan "Kelas A" dan mengonfirmasi
- **THEN** sesi tersebut selesai dan tetap tersedia di laporan, dan sesi-sesi "Kelas A" yang masih dijadwalkan tidak berubah

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

### Requirement: Sesi tertutup bersifat hanya-baca
Catatan kehadiran pada sesi yang sudah selesai (diakhiri manual, lewat batas pengisian, atau digantikan sesi berikutnya) maupun sesi yang masih dijadwalkan SHALL NOT dapat diubah melalui alur publik.

#### Scenario: Pengisian setelah sesi diakhiri
- **WHEN** pengguna yang membuka halaman sebelum sesi diakhiri men-tap status setelah sesi diakhiri
- **THEN** server menolak penyimpanan, sesi yang sudah selesai tidak berubah, dan halaman menampilkan keadaan terbaru (sesi berikutnya atau belum ada jadwal)

#### Scenario: Pengisian sebelum jam mulai
- **WHEN** klien mencoba mengisi kehadiran untuk kategori yang sesi berikutnya baru dimulai pukul 19.30, pada pukul 19.00
- **THEN** server menolak penyimpanan

### Requirement: Riwayat sesi
Admin SHALL dapat melihat daftar sesi sebuah kategori (label tanggal, jam, toleransi, catatan, keadaan dijadwalkan/berjalan/selesai, waktu dibuka dan ditutup, persentase hadir untuk sesi yang sudah mulai), dengan sesi dijadwalkan terdekat di atas diikuti sesi berjalan dan sesi selesai dari yang terbaru. Melalui "Ubah jadwal/catatan", admin SHALL dapat mengubah tanggal, jam, toleransi, dan catatan sesi yang dijadwalkan atau berjalan, serta tanggal dan catatan sesi yang sudah selesai.

#### Scenario: Melihat riwayat
- **WHEN** admin membuka riwayat sesi "Kelas A"
- **THEN** sistem menampilkan sesi dijadwalkan, sesi berjalan, dan sesi selesai dengan penanda keadaannya masing-masing

#### Scenario: Mengubah tanggal sesi
- **WHEN** admin mengubah tanggal sesi selesai dari 30 September menjadi 1 Oktober 2026
- **THEN** label sesi berubah menjadi "Kamis, 1 Oktober 2026" dan sesi itu masuk rekap bulan Oktober 2026

#### Scenario: Mengubah jam sesi dijadwalkan
- **WHEN** admin mengubah jam sesi dijadwalkan Kamis, 8 Oktober 2026 dari 19.30–21.00 menjadi 20.00–21.30
- **THEN** absen untuk sesi itu dibuka pukul 20.00 dan ditutup setelah 21.30 ditambah toleransinya

### Requirement: Jam sesi dan toleransi
Setiap sesi baru SHALL memiliki jam mulai dan jam selesai dalam WIB pada tanggal sesinya, dengan jam selesai lebih akhir dari jam mulai di hari yang sama, serta toleransi yang dipilih dari: tanpa toleransi, 6 jam, 12 jam, atau 24 jam (default tanpa toleransi). Batas pengisian sesi adalah jam selesai ditambah toleransi. Jam dan toleransi SHALL tampil bersama label sesi di panel admin dan halaman publik (mis. "Senin, 5 Oktober 2026 · 19.30–21.00").

#### Scenario: Sesi dengan toleransi
- **WHEN** admin menjadwalkan sesi Senin, 5 Oktober 2026 pukul 19.30–21.00 dengan toleransi 6 jam
- **THEN** sesi itu dibuka pukul 19.30 dan pengisian ditutup Selasa, 6 Oktober 2026 pukul 03.00

#### Scenario: Jam selesai tidak valid
- **WHEN** admin mengisi jam selesai yang sama dengan atau lebih awal dari jam mulai
- **THEN** sistem menolak penyimpanan dan menampilkan pesan validasi

#### Scenario: Jam wajib
- **WHEN** admin mencoba menyimpan sesi tanpa jam mulai atau jam selesai
- **THEN** sistem menolak penyimpanan

### Requirement: Keadaan sesi dan penutupan otomatis
Setiap sesi SHALL berada pada salah satu keadaan: **dijadwalkan** (sebelum jam mulai), **berjalan** (sejak jam mulai sampai batas pengisian), atau **selesai**. Sesi SHALL menjadi berjalan tepat pada jam mulai tanpa tindakan admin. Setelah batas pengisian lewat, sesi SHALL selesai otomatis dengan efek yang sama seperti "Akhiri sesi" (anggota yang belum mengisi dicatat dengan status otomatis kategori), paling lambat beberapa menit setelah batas itu; pengisian publik SHALL ditolak tepat setelah batas pengisian meskipun penutupan belum diproses. Bila sebuah sesi mulai sementara sesi lain di kategori yang sama masih berjalan, sesi sebelumnya SHALL selesai otomatis saat itu juga, sehingga setiap kategori memiliki paling banyak satu sesi berjalan. Sesi lama tanpa jam SHALL dianggap berjalan sampai diakhiri manual atau sampai sesi berikutnya mulai.

#### Scenario: Sesi dibuka otomatis
- **WHEN** sesi dijadwalkan pukul 19.30 dan jam menunjukkan 19.30
- **THEN** sesi menjadi berjalan dan orang tua dapat mengisi kehadiran tanpa admin melakukan apa pun

#### Scenario: Sesi selesai otomatis
- **WHEN** batas pengisian sesi "Kelas A" (21.00 tanpa toleransi) terlewati dan Budi belum mengisi
- **THEN** sesi menjadi selesai dan Budi tercatat dengan status otomatis kategori (mis. "Alpa") tanpa admin menekan "Akhiri sesi"

#### Scenario: Pengisian tepat setelah batas
- **WHEN** orang tua men-tap status pukul 21.00 lewat beberapa detik untuk sesi 19.30–21.00 tanpa toleransi
- **THEN** server menolak penyimpanan dan halaman menampilkan bahwa sesi sudah selesai

#### Scenario: Sesi berikutnya menggantikan sesi dalam toleransi
- **WHEN** sesi Senin 19.30–21.00 bertoleransi 24 jam masih berjalan dan sesi Selasa pukul 19.30 dimulai
- **THEN** sesi Senin selesai otomatis saat itu juga (yang belum mengisi dicatat status otomatis) dan pengisian berikutnya tercatat di sesi Selasa

#### Scenario: Sesi lama tanpa jam
- **WHEN** kategori memiliki sesi berjalan yang dibuat sebelum fitur jadwal (tanpa jam)
- **THEN** sesi itu tetap berjalan sampai admin menekan "Akhiri sesi" atau sesi berjam berikutnya dimulai

### Requirement: Jadwalkan sesi
Admin SHALL dapat menjadwalkan sesi melalui tombol "Jadwalkan sesi" dengan dua mode. **Satu sesi**: pilih tanggal (kalender, default hari ini), jam mulai, jam selesai, toleransi, dan catatan opsional. **Berulang**: pilih satu atau lebih hari dalam seminggu, jam mulai, jam selesai, toleransi, catatan opsional, dan rentang tanggal (default: hari ini sampai akhir bulan ini), lalu sistem SHALL menampilkan pratinjau daftar tanggal yang akan dibuat sebelum disimpan. Tanggal yang sudah memiliki sesi dengan jam mulai yang sama SHALL ditandai sebagai duplikat dan tidak dicentang secara default. Admin SHALL dapat mencentang atau melepas tiap tanggal di pratinjau. Penyimpanan berulang SHALL atomik dan dibatasi paling banyak 62 sesi per penyimpanan. Kategori boleh memiliki banyak sesi dijadwalkan sekaligus.

#### Scenario: Jadwal dua kali seminggu
- **WHEN** admin memilih mode Berulang di "Kelas A": Senin dan Kamis, 19.30–21.00, toleransi 12 jam, rentang 1–31 Oktober 2026
- **THEN** pratinjau menampilkan 9 tanggal (5, 8, 12, 15, 19, 22, 26, 29 Oktober dan Kamis 1 Oktober), dan setelah disimpan 9 sesi dijadwalkan dibuat dengan jam dan toleransi tersebut

#### Scenario: Melepas tanggal di pratinjau
- **WHEN** admin melepas centang Kamis, 22 Oktober 2026 (libur) di pratinjau lalu menyimpan
- **THEN** sesi dibuat untuk semua tanggal kecuali 22 Oktober

#### Scenario: Duplikat
- **WHEN** "Kelas A" sudah memiliki sesi Senin, 5 Oktober 2026 pukul 19.30 dan admin menjadwalkan ulang Senin 19.30 untuk bulan Oktober
- **THEN** 5 Oktober ditandai "sudah ada" dan tidak dicentang secara default

#### Scenario: Satu sesi di tengah jadwal
- **WHEN** admin menjadwalkan satu sesi tambahan Sabtu, 10 Oktober 2026 pukul 08.00–10.00
- **THEN** sesi itu dibuat tanpa mengubah sesi-sesi berulang yang sudah ada

#### Scenario: Terlalu banyak sesi
- **WHEN** pilihan berulang menghasilkan lebih dari 62 tanggal
- **THEN** sistem menolak dan meminta admin mempersempit rentang

### Requirement: Hapus sesi dijadwalkan
Admin SHALL dapat menghapus sesi yang masih dijadwalkan (belum mulai) dan belum memiliki catatan kehadiran. Sesi yang sudah berjalan atau selesai SHALL NOT dapat dihapus.

#### Scenario: Hapus sesi libur
- **WHEN** admin menghapus sesi dijadwalkan Kamis, 22 Oktober 2026
- **THEN** sesi itu hilang dari riwayat dan tidak akan dibuka

#### Scenario: Sesi berjalan tidak bisa dihapus
- **WHEN** admin mencoba menghapus sesi yang sedang berjalan
- **THEN** server menolak dan sistem menyarankan "Akhiri sesi"
