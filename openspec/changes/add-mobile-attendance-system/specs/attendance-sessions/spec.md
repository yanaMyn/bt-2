# Spec Delta

## Purpose

Mengelompokkan kehadiran per kategori ke dalam sesi/periode sehingga admin dapat me-reset kehadiran tanpa kehilangan riwayat yang dibutuhkan untuk laporan.

## ADDED Requirements

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

### Requirement: Satu sesi aktif per kategori
Setiap kategori SHALL memiliki tepat satu sesi aktif setiap saat. Semua pengisian kehadiran publik SHALL tercatat pada sesi aktif kategori tersebut. Setiap anggota SHALL memiliki paling banyak satu status per sesi.

#### Scenario: Kategori baru
- **WHEN** kategori baru dibuat
- **THEN** sebuah sesi aktif dibuat otomatis dengan tanggal sesi hari itu (WIB) dan tanpa catatan

#### Scenario: Pengisian tercatat di sesi aktif
- **WHEN** pengguna mengisi status Budi di "Kelas A"
- **THEN** status tercatat pada sesi aktif "Kelas A"

### Requirement: Reset kehadiran per kategori
Admin SHALL dapat me-reset kehadiran sebuah kategori. Reset SHALL menutup sesi aktif (mencatat waktu penutupan) dan membuka sesi aktif baru secara atomik. Admin SHALL memilih tanggal sesi baru melalui kalender (default: hari ini, WIB) dan boleh mengisi catatan sebelum konfirmasi. Reset SHALL NOT menghapus catatan kehadiran sesi yang ditutup, dan SHALL NOT memengaruhi kategori lain.

#### Scenario: Reset
- **WHEN** admin me-reset "Kelas A", memilih tanggal 3 Oktober 2026 di kalender, dan mengonfirmasi
- **THEN** sesi baru berlabel "Sabtu, 3 Oktober 2026", semua anggota "Kelas A" tampil "Belum" di halaman publik, persentase menjadi 0%, dan sesi sebelumnya tetap tersedia di laporan

#### Scenario: Konfirmasi reset
- **WHEN** admin menekan "Reset" pada sebuah kategori
- **THEN** sistem menampilkan dialog konfirmasi yang menyebut nama kategori dan jumlah catatan yang akan diarsipkan sebelum reset dijalankan

#### Scenario: Kategori lain tidak terpengaruh
- **WHEN** admin me-reset "Kelas A"
- **THEN** status kehadiran di "Kelas B" tidak berubah

### Requirement: Sesi tertutup bersifat hanya-baca
Catatan kehadiran pada sesi yang sudah ditutup SHALL NOT dapat diubah melalui alur publik.

#### Scenario: Pengisian setelah reset
- **WHEN** pengguna yang membuka halaman sebelum reset men-tap status setelah reset terjadi
- **THEN** status tercatat pada sesi aktif yang baru, bukan sesi yang sudah ditutup

### Requirement: Riwayat sesi
Admin SHALL dapat melihat daftar sesi sebuah kategori (label tanggal, catatan, waktu mulai, waktu tutup, persentase hadir) dan mengubah tanggal (lewat kalender) serta catatan sesi mana pun.

#### Scenario: Melihat riwayat
- **WHEN** admin membuka riwayat sesi "Kelas A"
- **THEN** sistem menampilkan semua sesi dari yang terbaru, dengan sesi aktif ditandai

#### Scenario: Mengubah tanggal sesi
- **WHEN** admin mengubah tanggal sesi lama dari 30 September menjadi 1 Oktober 2026
- **THEN** label sesi berubah menjadi "Kamis, 1 Oktober 2026" dan sesi itu masuk rekap bulan Oktober 2026
