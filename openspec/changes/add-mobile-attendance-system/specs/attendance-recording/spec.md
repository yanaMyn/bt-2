# Spec Delta

## Purpose

Menyediakan alur publik mobile-first yang sangat mudah bagi orang tua: pilih kategori, cari dan tap nama, lalu tap status kehadiran, dengan persentase kehadiran yang selalu terlihat dan diperbarui secara real-time.

## ADDED Requirements

### Requirement: Beranda daftar kategori
Halaman `/` SHALL menampilkan semua kategori aktif sebagai kartu yang dapat di-tap, masing-masing berisi nama kategori, persentase hadir sesi aktif, dan jumlah hadir/total anggota. Halaman ini SHALL dapat diakses tanpa login.

#### Scenario: Menampilkan kategori
- **WHEN** pengunjung membuka `/`
- **THEN** sistem menampilkan kartu tiap kategori dengan nama, persentase hadir, dan teks seperti "12/15 hadir"

#### Scenario: Membuka kategori
- **WHEN** pengunjung men-tap kartu "Kelas A"
- **THEN** sistem membuka `/k/kelas-a`

#### Scenario: Belum ada kategori
- **WHEN** belum ada kategori sama sekali
- **THEN** beranda menampilkan pesan kosong yang ramah

### Requirement: Halaman daftar anggota kategori
Halaman `/k/:slug` SHALL menampilkan label sesi aktif, persentase hadir keseluruhan serta per jenis kelamin (L dan P, masing-masing dengan jumlah hadir/total), kolom pencarian nama, dan daftar anggota kategori diurutkan berdasarkan nama. Setiap baris anggota SHALL menampilkan nama dan status sesi aktifnya berupa label berwarna, atau penanda "Belum" bila belum diisi.

#### Scenario: Menampilkan daftar
- **WHEN** pengunjung membuka `/k/kelas-a`
- **THEN** sistem menampilkan persentase keseluruhan, L, dan P, serta daftar anggota beserta statusnya

#### Scenario: Slug tidak ditemukan
- **WHEN** pengunjung membuka slug kategori yang tidak ada
- **THEN** sistem menampilkan pesan "Kategori tidak ditemukan" dan tautan kembali ke beranda

### Requirement: Pencarian nama
Kolom pencarian SHALL menyaring daftar anggota secara langsung saat pengguna mengetik, tanpa membedakan huruf besar/kecil dan mencocokkan bagian mana pun dari nama.

#### Scenario: Mencari nama
- **WHEN** pengguna mengetik "bud"
- **THEN** hanya anggota yang namanya mengandung "bud" (mis. "Budi", "Abdul Budiman") yang tampil

#### Scenario: Tidak ada hasil
- **WHEN** pencarian tidak cocok dengan siapa pun
- **THEN** sistem menampilkan pesan "Nama tidak ditemukan"

### Requirement: Pengisian status melalui bottom sheet
Men-tap nama anggota SHALL membuka bottom sheet berisi nama anggota dan tombol besar untuk setiap status aktif kategori sesuai urutannya, berwarna sesuai status, dengan status saat ini ditandai. Men-tap tombol status SHALL langsung menyimpan tanpa langkah konfirmasi, menutup sheet, dan menampilkan notifikasi "Tersimpan" dengan opsi "Batal" untuk mengembalikan status sebelumnya. Pengguna SHALL dapat mengubah status berulang kali selama sesi masih aktif; status terakhir menimpa yang sebelumnya.

#### Scenario: Mengisi status
- **WHEN** pengguna men-tap "Budi" lalu men-tap "Hadir"
- **THEN** status Budi di sesi aktif menjadi "Hadir", sheet tertutup, dan notifikasi "Tersimpan" tampil

#### Scenario: Mengubah status
- **WHEN** Budi sudah "Hadir" lalu pengguna men-tap "Budi" dan men-tap "Izin"
- **THEN** status Budi menjadi "Izin"

#### Scenario: Membatalkan
- **WHEN** pengguna men-tap "Batal" pada notifikasi "Tersimpan"
- **THEN** status Budi kembali ke nilai sebelumnya (termasuk kembali ke "Belum" bila sebelumnya belum diisi)

#### Scenario: Gagal menyimpan
- **WHEN** penyimpanan gagal (mis. jaringan terputus)
- **THEN** sistem menampilkan pesan gagal dan status di layar tidak berubah

### Requirement: Verifikasi PIN kategori
Bila PIN kategori aktif, halaman kategori SHALL menampilkan layar PIN (keypad angka 4 digit yang langsung memeriksa PIN saat digit ke-4 dimasukkan) sebagai pengganti persentase dan daftar anggota sampai PIN yang benar dimasukkan di perangkat tersebut. PIN SHALL diverifikasi di server, dan setelah benar disimpan di perangkat sehingga membuka kategori berikutnya tidak meminta PIN lagi. Setiap penyimpanan status SHALL diverifikasi PIN-nya di server. Bila PIN yang tersimpan tidak lagi valid (diganti admin) atau PIN baru saja diaktifkan, sistem SHALL menghapus PIN tersimpan dan menampilkan layar PIN lagi. Bila PIN tidak aktif, sistem SHALL NOT meminta PIN. Layar PIN adalah penghalang di tampilan; daftar nama tidak dirahasiakan di tingkat server.

#### Scenario: Membuka kategori ber-PIN pertama kali
- **WHEN** pengguna men-tap kartu kategori ber-PIN di beranda pada perangkat yang belum menyimpan PIN
- **THEN** halaman kategori menampilkan layar PIN tanpa persentase maupun daftar anggota

#### Scenario: PIN benar
- **WHEN** pengguna memasukkan PIN yang benar di layar PIN
- **THEN** persentase dan daftar anggota tampil, PIN tersimpan di perangkat, dan membuka kategori itu lagi (termasuk setelah memuat ulang) tidak meminta PIN

#### Scenario: PIN salah
- **WHEN** pengguna memasukkan PIN yang salah
- **THEN** sistem menampilkan "PIN salah" dan daftar anggota tetap tidak tampil

#### Scenario: PIN diganti admin
- **WHEN** admin mengganti PIN dan pengguna dengan PIN lama tersimpan men-tap status
- **THEN** penyimpanan ditolak, PIN lama dihapus dari perangkat, dan layar PIN tampil meminta PIN baru

#### Scenario: Kategori tanpa PIN
- **WHEN** pengguna membuka kategori yang PIN-nya tidak aktif
- **THEN** daftar anggota langsung tampil tanpa layar PIN

#### Scenario: Penulisan langsung tanpa PIN
- **WHEN** klien anonim mencoba menulis kehadiran langsung ke database atau memanggil fungsi penyimpanan tanpa PIN yang benar untuk kategori ber-PIN
- **THEN** server menolak penulisan tersebut

### Requirement: Perhitungan persentase hadir
Persentase hadir sebuah kategori (atau kelompok jenis kelamin di dalamnya) SHALL dihitung sebagai jumlah anggota kategori yang status sesi aktifnya ditandai dihitung hadir, dibagi jumlah seluruh anggota kategori (atau kelompok tersebut), dibulatkan ke bilangan bulat terdekat. Anggota yang belum diisi SHALL tetap dihitung dalam penyebut. Bila penyebut nol, sistem SHALL menampilkan "0%" beserta "0/0".

#### Scenario: Perhitungan dasar
- **WHEN** kategori memiliki 82 anggota L dengan 77 berstatus yang dihitung hadir
- **THEN** persentase L tampil "94%" dengan keterangan "77/82"

#### Scenario: Anggota belum diisi
- **WHEN** kategori memiliki 10 anggota, 6 "Hadir", 1 "Izin" (tidak dihitung hadir), 3 belum diisi
- **THEN** persentase tampil "60%"

### Requirement: Pembaruan real-time
Halaman beranda dan halaman kategori SHALL memperbarui status dan persentase secara otomatis ketika data kehadiran berubah dari perangkat lain, tanpa pengguna memuat ulang halaman.

#### Scenario: Dua perangkat
- **WHEN** perangkat A dan B membuka `/k/kelas-a` dan perangkat A mengisi Budi "Hadir"
- **THEN** perangkat B menampilkan Budi "Hadir" dan persentase terbaru dalam beberapa detik

### Requirement: Tampilan ramah orang tua di ponsel
Antarmuka publik SHALL dirancang mobile-first: tidak ada scroll horizontal pada lebar layar 360px, ukuran teks isi minimal 16px, area sentuh tombol status minimal 56px tingginya, dan status selalu ditampilkan dengan label teks (bukan warna saja).

#### Scenario: Layar kecil
- **WHEN** halaman kategori dibuka di layar selebar 360px
- **THEN** seluruh konten muat tanpa scroll horizontal dan tombol status mudah di-tap
