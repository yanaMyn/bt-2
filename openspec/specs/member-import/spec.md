# member-import Specification

## Purpose

Mempercepat input anggota dengan import massal dari file `.xlsx` ke satu kategori, lengkap dengan template dan preview sebelum data disimpan.

## Requirements

### Requirement: Template import
Sistem SHALL menyediakan file template `.xlsx` yang dapat diunduh admin, berisi kolom "Nama" dan "Jenis Kelamin" beserta contoh baris.

#### Scenario: Unduh template
- **WHEN** admin menekan "Unduh template" di halaman import
- **THEN** browser mengunduh file `.xlsx` dengan header "Nama" dan "Jenis Kelamin"

### Requirement: Import satu kategori per file
Admin SHALL memilih tepat satu kategori tujuan sebelum mengunggah file. Sistem SHALL membaca sheet pertama, mencocokkan header "Nama" dan "Jenis Kelamin" tanpa membedakan huruf besar/kecil, dan menerima nilai jenis kelamin "L", "P", "Laki-laki", "Laki-Laki", "Perempuan" (tanpa membedakan huruf besar/kecil dan spasi di tepi).

#### Scenario: Header tidak ditemukan
- **WHEN** admin mengunggah file tanpa kolom "Nama" atau "Jenis Kelamin"
- **THEN** sistem menampilkan pesan bahwa format file tidak sesuai template dan tidak menyimpan apa pun

#### Scenario: File bukan xlsx
- **WHEN** admin mengunggah file selain `.xlsx`
- **THEN** sistem menolak file tersebut

### Requirement: Preview sebelum simpan
Sistem SHALL menampilkan preview semua baris sebelum menyimpan, dengan klasifikasi: valid (akan dibuat), tidak valid (nama kosong atau jenis kelamin tidak dikenali, selalu dilewati), dan duplikat (nama dan jenis kelamin sama persis—mengabaikan huruf besar/kecil dan spasi berlebih—dengan anggota yang sudah ada di kategori tujuan atau dengan baris lain di file yang sama). Baris duplikat SHALL tidak dicentang secara default, tetapi admin SHALL dapat mencentangnya agar tetap dibuat. Tidak ada data yang disimpan sebelum admin mengonfirmasi.

#### Scenario: Preview campuran
- **WHEN** admin mengunggah file berisi 10 baris valid, 1 baris tanpa nama, dan 2 baris yang namanya sudah ada di kategori tujuan
- **THEN** preview menampilkan 10 baris valid tercentang, 1 baris tidak valid yang tidak bisa dicentang, dan 2 baris duplikat yang tidak tercentang

#### Scenario: Batal import
- **WHEN** admin menutup preview tanpa konfirmasi
- **THEN** tidak ada data yang tersimpan

### Requirement: Import selalu membuat orang baru
Untuk setiap baris yang dicentang, sistem SHALL membuat data orang baru dan menjadikannya anggota kategori tujuan, tanpa menautkan ke orang yang sudah ada di kategori lain. Penyimpanan SHALL bersifat atomik: semua baris tercentang tersimpan, atau tidak ada sama sekali bila terjadi kegagalan.

#### Scenario: Nama sama di kategori lain
- **WHEN** admin mengimpor "Ahmad Fauzi, L" ke "Kajian" sementara "Ahmad Fauzi, L" sudah ada di "Kelas A"
- **THEN** baris itu berstatus valid, dan orang baru "Ahmad Fauzi" dibuat untuk "Kajian", terpisah dari yang di "Kelas A"

#### Scenario: Konfirmasi import
- **WHEN** admin mengonfirmasi preview dengan 12 baris tercentang
- **THEN** 12 orang baru dibuat sebagai anggota kategori tujuan dan sistem menampilkan ringkasan "12 anggota ditambahkan"

#### Scenario: Kegagalan saat simpan
- **WHEN** penyimpanan gagal di tengah proses
- **THEN** tidak ada orang maupun keanggotaan yang tersimpan dan sistem menampilkan pesan gagal
