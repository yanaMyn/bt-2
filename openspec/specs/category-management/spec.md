# category-management Specification

## Purpose

Memungkinkan admin membuat dan mengelola kategori/grup kehadiran secara dinamis, termasuk mengatur PIN per kategori yang bisa dinyalakan atau dimatikan.

## Requirements

### Requirement: CRUD kategori
Kategori ditampilkan sebagai **Kegiatan**. Admin SHALL dapat membuat, melihat, mengubah nama, wilayah, dan kriteria, serta menghapus kegiatan milik unitnya (Daerah, Desa, atau Kelompok); admin SHALL NOT dapat membuat atau mengubah kegiatan milik unit lain. Nama kegiatan SHALL unik di dalam unit pemiliknya, dan slug URL SHALL unik secara global serta diturunkan dari nama kegiatan dan nama unit pemiliknya. Kegiatan baru SHALL memiliki status bawaan tetapi belum memiliki sesi; admin menjadwalkan sesi berjam melalui tab Sesi.

#### Scenario: Membuat kategori
- **WHEN** admin Kelompok Baitul Ilmi membuat kegiatan "Remaja"
- **THEN** kegiatan tersimpan milik Kelompok Baitul Ilmi dengan slug `remaja-baitul-ilmi`, tampil di halaman kelompok publik dengan keterangan "Belum ada jadwal sesi", memiliki status bawaan, dan belum memiliki sesi

#### Scenario: Nama duplikat
- **WHEN** admin membuat kegiatan dengan nama yang sudah dipakai kegiatan lain milik unit yang sama
- **THEN** sistem menolak dan menampilkan pesan bahwa nama sudah dipakai, sedangkan nama yang sama di unit lain (mis. "Remaja" di Kelompok Citra) diperbolehkan

#### Scenario: Mengubah nama
- **WHEN** admin mengubah nama kegiatan "Remaja" menjadi "Remaja Putra-Putri"
- **THEN** nama baru tampil di semua halaman dan riwayat kehadiran tetap utuh

#### Scenario: Menghapus kategori
- **WHEN** admin menghapus kegiatan dan mengonfirmasi dengan mengetik nama kegiatan
- **THEN** kegiatan beserta status, sesi, dan catatan kehadirannya terhapus, sedangkan data jamaah tetap ada

### Requirement: Pengaturan PIN per kategori
Admin SHALL dapat menyalakan atau mematikan PIN untuk setiap kategori secara terpisah, dan mengatur atau mengganti PIN berupa tepat 4 digit angka. Admin SHALL dapat melihat PIN yang sedang aktif melalui tombol mata; PIN tersembunyi secara default. PIN SHALL hanya dapat dibaca oleh admin yang login dan SHALL NOT pernah dikirim ke klien publik.

#### Scenario: Menyalakan PIN
- **WHEN** admin menyalakan PIN untuk "Kelas A" dan mengisi PIN "1234"
- **THEN** membuka "Kelas A" di halaman publik mensyaratkan PIN tersebut

#### Scenario: PIN bukan 4 digit
- **WHEN** admin menyalakan PIN dengan PIN kosong, bukan angka, atau panjangnya selain 4 digit (mis. "123" atau "12345")
- **THEN** sistem menolak penyimpanan dan menampilkan pesan validasi

#### Scenario: Melihat PIN
- **WHEN** admin membuka pengaturan kategori ber-PIN dan menekan tombol mata
- **THEN** PIN yang sedang aktif tampil; menekan tombol mata lagi menyembunyikannya

#### Scenario: Mematikan PIN
- **WHEN** admin mematikan PIN untuk "Kelas B"
- **THEN** pengguna dapat membuka "Kelas B" dan mengisi kehadiran tanpa PIN

#### Scenario: PIN tidak bocor
- **WHEN** klien publik (tanpa login) membaca data kategori
- **THEN** respons hanya memuat apakah PIN aktif, tanpa nilai PIN

### Requirement: Aktif/nonaktif kategori
Admin SHALL dapat menonaktifkan dan mengaktifkan kembali sebuah kategori. Kategori baru SHALL aktif secara default. Kategori nonaktif SHALL NOT tampil di beranda publik, SHALL NOT dapat dibuka lewat halaman kategori publik, dan server SHALL menolak pengisian kehadiran untuknya. Menonaktifkan kategori SHALL NOT menghapus atau mengubah anggota, status, sesi, maupun catatan kehadirannya, dan kategori nonaktif SHALL tetap tampil di panel admin dengan penanda "Nonaktif".

#### Scenario: Menonaktifkan kategori
- **WHEN** admin menonaktifkan kategori "Desaan CNB"
- **THEN** kartu "Desaan CNB" hilang dari beranda publik, dan kategori tetap tampil di daftar kategori admin dengan penanda "Nonaktif"

#### Scenario: Membuka link kategori nonaktif
- **WHEN** pengunjung membuka `/k/desaan-cnb` saat kategori itu nonaktif
- **THEN** sistem menampilkan "Kategori tidak ditemukan"

#### Scenario: Penulisan ke kategori nonaktif
- **WHEN** klien anonim memanggil fungsi penyimpanan kehadiran untuk kategori nonaktif
- **THEN** server menolak penulisan tersebut

#### Scenario: Mengaktifkan kembali
- **WHEN** admin mengaktifkan kembali "Desaan CNB"
- **THEN** kartu kategori tampil lagi di beranda dengan anggota, status, dan kehadiran sesi aktif yang sama seperti sebelum dinonaktifkan

#### Scenario: Kategori nonaktif tidak bocor lewat API
- **WHEN** klien anonim membaca tabel kategori atau ringkasan kategori secara langsung
- **THEN** kategori nonaktif tidak termasuk dalam hasilnya

### Requirement: Wilayah peserta kegiatan
Wilayah peserta SHALL ditentukan oleh unit pemilik kegiatan: kegiatan milik Kelompok mencakup jamaah kelompok itu; kegiatan milik Desa mencakup jamaah dari satu atau lebih Kelompok yang dipilih di Desa itu (default semua kelompok di Desa); kegiatan milik Daerah mencakup jamaah dari satu atau lebih Desa yang dipilih (default semua Desa). Kelompok atau Desa baru SHALL ikut tercakup otomatis bila wilayah kegiatan diatur "semua".

#### Scenario: Kegiatan Desa untuk sebagian kelompok
- **WHEN** Admin Desa CNT membuat kegiatan "Desaan CNT" dan memilih Kelompok Baitul Ilmi dan Citra
- **THEN** peserta kegiatan itu adalah jamaah aktif kedua kelompok yang memenuhi kriteria

#### Scenario: Kelompok baru tercakup otomatis
- **WHEN** kegiatan Desa diatur mencakup semua kelompok dan Admin Desa menambah Kelompok baru
- **THEN** jamaah kelompok baru itu ikut menjadi peserta tanpa mengubah kegiatan

### Requirement: Kriteria peserta kegiatan
Setiap kegiatan SHALL memiliki kriteria peserta: jenis kelamin (semua, L, atau P), rentang umur (minimal dan/atau maksimal dalam tahun, boleh kosong), dan status nikah (semua, belum menikah, atau pernah menikah yang mencakup menikah dan janda/duda). Umur SHALL dihitung dalam tahun penuh pada tanggal sesi. Peserta kegiatan SHALL adalah jamaah aktif dalam wilayah kegiatan yang memenuhi semua kriteria; bila kegiatan memakai batas umur, jamaah tanpa tanggal lahir SHALL NOT termasuk. Satu jamaah SHALL boleh menjadi peserta beberapa kegiatan sekaligus. Perubahan kriteria SHALL berlaku untuk sesi berjalan dan berikutnya, tidak untuk sesi yang sudah selesai.

#### Scenario: Remaja 16–19
- **WHEN** kegiatan "Remaja" berkriteria umur 16–19 dan sesinya bertanggal 5 Oktober 2026
- **THEN** jamaah yang berulang tahun ke-16 pada 5 Oktober 2026 termasuk peserta, dan jamaah yang berulang tahun ke-20 pada 4 Oktober 2026 tidak

#### Scenario: Ibu-ibu mencakup janda
- **WHEN** kegiatan "Ibu-ibu" berkriteria P dan pernah menikah
- **THEN** jamaah perempuan berstatus menikah maupun janda termasuk peserta, dan yang belum menikah tidak

#### Scenario: Peserta di dua kegiatan
- **WHEN** seorang jamaah L berumur 21 tahun dan belum menikah, dan kelompoknya punya kegiatan "Muda Mudi" (20+, belum menikah) dan "Dewasa L" (L, 20+)
- **THEN** ia menjadi peserta kedua kegiatan, dengan kehadiran dicatat terpisah per kegiatan

#### Scenario: Tanggal lahir kosong
- **WHEN** jamaah tanpa tanggal lahir berada di kelompok yang memiliki kegiatan "Caberawit" (5–11)
- **THEN** ia tidak menjadi peserta Caberawit, tetapi tetap menjadi peserta kegiatan tanpa batas umur

### Requirement: Templat kriteria peserta
Admin Daerah SHALL dapat menambah, mengubah, dan menghapus templat kriteria yang tersedia untuk semua admin saat membuat kegiatan. Templat bawaan SHALL berisi: Caberawit (5–11), Pra Remaja (12–15), Remaja (16–19), Muda Mudi (20+, belum menikah), Dewasa L (L, 20+), Dewasa P (P, 20+), Bapak-bapak (L, pernah menikah), Ibu-ibu (P, pernah menikah), dan Lansia (50+). Memilih templat SHALL mengisi nama dan kriteria kegiatan yang tetap dapat diubah sebelum disimpan; mengubah templat SHALL NOT mengubah kegiatan yang sudah dibuat.

#### Scenario: Membuat kegiatan dari templat
- **WHEN** admin Kelompok Baitul Ilmi memilih templat "Caberawit"
- **THEN** formulir terisi nama "Caberawit" dan kriteria umur 5–11 yang masih bisa diubah

#### Scenario: Mengubah templat
- **WHEN** Admin Daerah mengubah templat Remaja menjadi 15–19
- **THEN** kegiatan baru dari templat Remaja memakai 15–19, dan kegiatan Remaja yang sudah ada tetap 16–19

#### Scenario: Kegiatan tanpa templat
- **WHEN** admin Kelompok membuat kegiatan "Tahfidz" dengan kriteria sendiri (semua, 10–25)
- **THEN** kegiatan tersimpan dengan kriteria tersebut
