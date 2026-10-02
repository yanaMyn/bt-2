# attendance-recording Specification

## Purpose

Menyediakan alur publik mobile-first yang sangat mudah bagi orang tua: pilih kategori, cari dan tap nama, lalu tap status kehadiran, dengan persentase kehadiran yang selalu terlihat dan diperbarui secara real-time.

## Requirements

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
Halaman kelompok dan halaman kegiatan SHALL memperbarui status dan persentase secara otomatis ketika data kehadiran berubah dari perangkat lain, tanpa pengguna memuat ulang halaman, paling lambat beberapa detik (target ≤ 5 detik) setelah perubahan tersimpan. Halaman kegiatan SHALL hanya bereaksi terhadap perubahan pada sesi yang sedang ditampilkannya, dan halaman kelompok SHALL hanya bereaksi terhadap perubahan pada sesi berjalan dari kegiatan yang ditampilkannya serta perubahan jadwal sesi; perubahan di kegiatan lain SHALL NOT memicu pengambilan data ulang. Banyak perubahan yang terjadi berdekatan (mis. saat sesi ditutup dan status otomatis dicatat untuk banyak peserta) SHALL menghasilkan paling banyak satu kali pengambilan data ulang per halaman per rentetan. Saat halaman tidak terlihat (tab di latar belakang atau layar mati) lebih dari satu menit, halaman SHALL berhenti menerima pembaruan langsung, dan saat kembali terlihat SHALL langsung menampilkan data terbaru. Bila pembaruan langsung tidak dapat tersambung (mis. kuota koneksi penuh), halaman yang terlihat SHALL tetap menyegarkan datanya secara berkala (paling lama setiap 30 detik) tanpa menampilkan error kepada pengguna.

#### Scenario: Dua perangkat
- **WHEN** perangkat A dan B membuka `/k/kelas-a` dan perangkat A mengisi Budi "Hadir"
- **THEN** perangkat B menampilkan Budi "Hadir" dan persentase terbaru dalam beberapa detik

#### Scenario: Isian di kegiatan lain tidak memicu muat ulang
- **WHEN** perangkat B membuka halaman Kegiatan Remaja Baitul Ilmi dan ada isian baru di Pengajian Ibu-ibu Citra
- **THEN** perangkat B tidak mengambil data ulang dan tampilannya tidak berubah

#### Scenario: Penutupan sesi
- **WHEN** sesi berjalan ditutup otomatis dan 40 peserta yang belum mengisi dicatat "Alpa" sekaligus
- **THEN** setiap perangkat yang membuka halaman kegiatan atau kelompok terkait menampilkan keadaan akhir sesi setelah paling banyak satu kali pengambilan data ulang

#### Scenario: Kembali dari latar belakang
- **WHEN** pengguna meninggalkan halaman kegiatan di tab latar belakang selama 10 menit lalu membukanya lagi
- **THEN** halaman langsung menampilkan status dan persentase terbaru tanpa pengguna memuat ulang

#### Scenario: Pembaruan langsung tidak tersedia
- **WHEN** halaman kegiatan terbuka tetapi koneksi pembaruan langsung ditolak karena kuota penuh
- **THEN** halaman tetap menampilkan isian dari perangkat lain paling lama sekitar 30 detik kemudian, tanpa pesan error

### Requirement: Tampilan ramah orang tua di ponsel
Antarmuka publik SHALL dirancang mobile-first: tidak ada scroll horizontal pada lebar layar 360px, ukuran teks isi minimal 16px, area sentuh tombol status minimal 56px tingginya, dan status selalu ditampilkan dengan label teks (bukan warna saja).

#### Scenario: Layar kecil
- **WHEN** halaman kategori dibuka di layar selebar 360px
- **THEN** seluruh konten muat tanpa scroll horizontal dan tombol status mudah di-tap

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
