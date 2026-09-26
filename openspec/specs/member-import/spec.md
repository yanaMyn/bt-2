# member-import Specification

## Purpose

Mempercepat input anggota dengan import massal dari file `.xlsx` ke satu kategori, lengkap dengan template dan preview sebelum data disimpan.

## Requirements

### Requirement: Template import
Sistem SHALL menyediakan file template `.xlsx` yang dapat diunduh admin Kelompok, berisi kolom "Nama", "Jenis Kelamin", "Tanggal Lahir", dan "Status Nikah" beserta contoh baris dan keterangan nilai yang diterima.

#### Scenario: Unduh template
- **WHEN** admin Kelompok menekan "Unduh template" di halaman import
- **THEN** browser mengunduh file `.xlsx` dengan header "Nama", "Jenis Kelamin", "Tanggal Lahir", dan "Status Nikah"

### Requirement: Preview sebelum simpan
Sistem SHALL menampilkan preview semua baris sebelum menyimpan, dengan klasifikasi: valid (akan dibuat), tidak valid (nama kosong, jenis kelamin tidak dikenali, tanggal lahir tidak terbaca atau di masa depan, atau status nikah tidak dikenali; selalu dilewati), dan duplikat (nama dan jenis kelamin sama persis—mengabaikan huruf besar/kecil dan spasi berlebih—dengan jamaah aktif di kelompok admin atau dengan baris lain di file yang sama). Baris valid tanpa tanggal lahir SHALL ditandai "data belum lengkap". Baris duplikat SHALL tidak dicentang secara default, tetapi admin SHALL dapat mencentangnya agar tetap dibuat. Tidak ada data yang disimpan sebelum admin mengonfirmasi.

#### Scenario: Preview campuran
- **WHEN** admin mengunggah file berisi 10 baris valid, 1 baris tanpa nama, dan 2 baris yang namanya sudah ada di kelompoknya
- **THEN** preview menampilkan 10 baris valid tercentang, 1 baris tidak valid yang tidak bisa dicentang, dan 2 baris duplikat yang tidak tercentang

#### Scenario: Batal import
- **WHEN** admin menutup preview tanpa konfirmasi
- **THEN** tidak ada data yang tersimpan

### Requirement: Import ke kelompok
Hanya admin Kelompok SHALL dapat mengimpor, dan jamaah hasil impor SHALL masuk ke kelompoknya sendiri (tidak ada pilihan tujuan). Sistem SHALL membaca sheet pertama dan mencocokkan header "Nama", "Jenis Kelamin", "Tanggal Lahir", dan "Status Nikah" tanpa membedakan huruf besar/kecil; "Nama" dan "Jenis Kelamin" wajib ada, dua kolom lainnya opsional. Nilai jenis kelamin yang diterima sama seperti sebelumnya ("L", "P", "Laki-laki", "Perempuan"). Tanggal lahir SHALL diterima sebagai tanggal Excel atau teks "DD/MM/YYYY" atau "YYYY-MM-DD". Status nikah SHALL diterima sebagai "Belum Menikah"/"Belum", "Menikah", atau "Janda"/"Duda"/"Janda/Duda"; kosong berarti belum menikah. Penyimpanan SHALL atomik.

#### Scenario: Import dengan tanggal lahir
- **WHEN** admin Kelompok Baitul Ilmi mengimpor file berisi "Budi | L | 12/05/2012 | Belum"
- **THEN** Budi dibuat sebagai jamaah Baitul Ilmi dengan tanggal lahir 12 Mei 2012 dan status belum menikah

#### Scenario: Header tidak ditemukan
- **WHEN** admin mengunggah file tanpa kolom "Nama" atau "Jenis Kelamin"
- **THEN** sistem menampilkan pesan bahwa format file tidak sesuai template dan tidak menyimpan apa pun

#### Scenario: File bukan xlsx
- **WHEN** admin mengunggah file selain `.xlsx`
- **THEN** sistem menolak file tersebut

#### Scenario: Admin Desa tidak bisa import
- **WHEN** Admin Desa membuka panel admin
- **THEN** menu import jamaah tidak tersedia, dan pemanggilan fungsi impor oleh Admin Desa ditolak server
