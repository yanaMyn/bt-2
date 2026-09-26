# member-management Specification

## Purpose

Mengelola data orang (nama dan jenis kelamin) secara global dan keanggotaannya di satu atau lebih kategori, sehingga orang yang sama bisa diabsen di beberapa grup.

## Requirements

### Requirement: Pagination daftar anggota admin
Daftar jamaah di panel admin SHALL dibagi per halaman dengan pilihan 10, 25, atau 50 nama per halaman (default 25), beserta navigasi halaman sebelumnya/berikutnya dan keterangan posisi (mis. "26–50 dari 120"). Pilihan jumlah per halaman SHALL diingat di perangkat admin. Pencarian dan filter SHALL berlaku pada seluruh data, bukan hanya halaman yang tampil, dan mengubah kata pencarian, filter, atau jumlah per halaman SHALL kembali ke halaman 1. Pilihan kotak centang SHALL tetap tersimpan saat berpindah halaman.

#### Scenario: Ganti jumlah per halaman
- **WHEN** kelompok memiliki 120 jamaah dan admin memilih 50 per halaman
- **THEN** daftar menampilkan 50 nama, keterangan "1–50 dari 120", dan 3 halaman

#### Scenario: Pencarian lintas halaman
- **WHEN** admin berada di halaman 3 lalu mengetik nama yang ada di halaman 1
- **THEN** daftar kembali ke halaman 1 dan menampilkan nama tersebut

#### Scenario: Pilihan tetap saat pindah halaman
- **WHEN** admin mencentang 3 nama di halaman 1 lalu pindah ke halaman 2 dan mencentang 2 nama
- **THEN** bilah aksi menampilkan "5 dipilih"

### Requirement: Data jamaah milik kelompok
Setiap jamaah SHALL tercatat di tepat satu kelompok asal dengan atribut nama (wajib), jenis kelamin (L/P, wajib), tanggal lahir (opsional, tidak boleh di masa depan), dan status nikah (belum menikah, menikah, atau janda/duda; default belum menikah). Hanya admin Kelompok SHALL dapat menambah dan mengubah jamaah kelompoknya. Admin Desa SHALL dapat melihat jamaah semua kelompok di Desanya, dan Admin Daerah SHALL dapat melihat semua jamaah, tanpa bisa mengubahnya. Tanggal lahir dan status nikah SHALL NOT terbaca oleh pengunjung publik.

#### Scenario: Menambah jamaah
- **WHEN** admin Kelompok Baitul Ilmi menambah jamaah "Budi", L, lahir 12 Mei 2012, belum menikah
- **THEN** Budi tercatat sebagai jamaah Kelompok Baitul Ilmi dan otomatis menjadi peserta kegiatan yang kriterianya cocok

#### Scenario: Tanggal lahir di masa depan
- **WHEN** admin mengisi tanggal lahir setelah hari ini
- **THEN** sistem menolak dan menampilkan pesan validasi

#### Scenario: Admin Desa hanya melihat
- **WHEN** Admin Desa CNT membuka menu jamaah
- **THEN** jamaah semua kelompok di Desa CNT tampil beserta nama kelompoknya tanpa tombol tambah, ubah, atau hapus

#### Scenario: Data pribadi tidak publik
- **WHEN** klien anonim membaca data jamaah
- **THEN** tanggal lahir dan status nikah tidak termasuk dalam respons

### Requirement: Pindah kelompok
Admin kelompok asal SHALL dapat melepas seorang jamaah aktif ke kelompok tujuan mana pun di Daerah. Permintaan SHALL tampil di "Permintaan masuk" kelompok tujuan, dan admin kelompok tujuan SHALL dapat menerima atau menolaknya; admin kelompok asal SHALL dapat membatalkan selama belum diputuskan. Selama permintaan menunggu, jamaah SHALL tetap menjadi jamaah kelompok asal dan SHALL NOT dapat dilepas lagi. Bila diterima, jamaah SHALL menjadi jamaah kelompok tujuan sejak saat diterima, dan riwayat perpindahan (asal, tujuan, waktu, admin yang melepas dan menerima) SHALL tercatat. Admin Desa dan Admin Daerah SHALL NOT dapat memindahkan jamaah. Admin kelompok asal SHALL dapat menuliskan alasan pindah (opsional, maksimal 500 karakter), dan admin kelompok tujuan SHALL dapat menuliskan alasan penolakan (opsional, maksimal 500 karakter); kedua alasan SHALL terlihat oleh kedua kelompok di riwayat perpindahan. Permintaan masuk SHALL menampilkan data jamaah yang dibutuhkan untuk memutuskan (nama, jenis kelamin, umur/tanggal lahir, status nikah, kelompok asal, dan admin yang melepas), meskipun jamaah itu belum menjadi jamaah kelompok tujuan.

#### Scenario: Pindah antar kelompok
- **WHEN** admin Baitul Ilmi melepas Budi ke Kelompok Citra dan admin Citra menerimanya
- **THEN** Budi menjadi jamaah Kelompok Citra, tidak lagi menjadi peserta kegiatan Baitul Ilmi, menjadi peserta kegiatan Citra yang kriterianya cocok, dan riwayat perpindahan tercatat

#### Scenario: Menunggu diterima
- **WHEN** admin Baitul Ilmi sudah melepas Budi tetapi admin Citra belum memutuskan
- **THEN** Budi tetap tampil dan tetap menjadi peserta di kegiatan Baitul Ilmi, dengan penanda "menunggu diterima Kelompok Citra"

#### Scenario: Ditolak atau dibatalkan
- **WHEN** admin Citra menolak, atau admin Baitul Ilmi membatalkan sebelum diputuskan
- **THEN** Budi tetap menjadi jamaah Baitul Ilmi tanpa perubahan dan permintaan tercatat ditolak atau dibatalkan

#### Scenario: Detail dan alasan pada permintaan masuk
- **WHEN** admin Baitul Ilmi melepas Budi ke Citra dengan alasan "Menikah, ikut suami"
- **THEN** admin Citra melihat nama, jenis kelamin, umur, status nikah, dan kelompok asal Budi beserta alasannya

#### Scenario: Alasan penolakan
- **WHEN** admin Citra menolak permintaan Budi dengan alasan "Belum ada konfirmasi"
- **THEN** admin Baitul Ilmi melihat alasan itu di riwayat perpindahan; alasan yang dikosongkan tidak disimpan

#### Scenario: Riwayat sesi tetap
- **WHEN** Budi pindah ke Citra setelah mengikuti sesi-sesi Baitul Ilmi yang sudah selesai
- **THEN** laporan sesi-sesi lama itu tetap menampilkan Budi dengan asal Kelompok Baitul Ilmi

### Requirement: Jamaah nonaktif
Admin Kelompok SHALL dapat menonaktifkan jamaahnya dengan alasan (meninggal, pindah ke luar daerah, lainnya) dan tanggal mulai nonaktif, serta mengaktifkannya kembali. Jamaah nonaktif SHALL NOT menjadi peserta sesi bertanggal pada atau setelah tanggal nonaktif, tetapi riwayat kehadirannya SHALL tetap ada di laporan. Jamaah yang sedang dalam permintaan pindah SHALL NOT dapat dinonaktifkan sebelum permintaannya diputuskan atau dibatalkan.

#### Scenario: Jamaah meninggal
- **WHEN** admin menonaktifkan Pak Ahmad dengan alasan meninggal sejak 12 Oktober 2026
- **THEN** Pak Ahmad tidak lagi muncul di daftar pengisian sesi bertanggal 12 Oktober 2026 dan setelahnya, dan laporan sesi sebelumnya tetap menampilkannya

#### Scenario: Diaktifkan kembali
- **WHEN** admin mengaktifkan kembali jamaah yang keliru dinonaktifkan
- **THEN** jamaah kembali menjadi peserta kegiatan yang kriterianya cocok

### Requirement: Hapus jamaah
Admin Kelompok SHALL dapat menghapus permanen jamaah kelompoknya hanya bila jamaah itu belum memiliki catatan kehadiran maupun riwayat perpindahan. Untuk jamaah dengan riwayat, sistem SHALL menolak dan menyarankan menonaktifkan.

#### Scenario: Salah input
- **WHEN** admin menghapus jamaah yang baru diinput dan belum pernah diabsen
- **THEN** jamaah terhapus permanen

#### Scenario: Jamaah dengan riwayat
- **WHEN** admin mencoba menghapus jamaah yang sudah memiliki catatan kehadiran
- **THEN** sistem menolak dan menyarankan "Nonaktifkan"

### Requirement: Aksi massal jamaah
Admin Kelompok SHALL dapat memilih banyak jamaah sekaligus di daftar jamaah (kotak centang per baris dan "Pilih semua" untuk seluruh hasil pencarian/filter di semua halaman) lalu menonaktifkan (dengan satu alasan dan tanggal) atau menghapus mereka. Hapus massal SHALL hanya menghapus jamaah tanpa riwayat dan menyebutkan jamaah yang dilewati. Aksi massal SHALL atomik per aksi.

#### Scenario: Hapus hasil import yang salah
- **WHEN** admin memilih 10 jamaah hasil import yang salah (belum pernah diabsen) lalu memilih "Hapus"
- **THEN** kesepuluh jamaah terhapus

#### Scenario: Hapus massal dengan sebagian punya riwayat
- **WHEN** admin memilih 5 jamaah dan 2 di antaranya punya catatan kehadiran lalu memilih "Hapus"
- **THEN** 3 jamaah terhapus dan sistem menyebutkan 2 jamaah dilewati karena punya riwayat

### Requirement: Filter dan kelengkapan data jamaah
Daftar jamaah admin SHALL dapat difilter berdasarkan desa dan kelompok (sesuai cakupan admin), status (aktif/nonaktif/menunggu pindah), dan "data belum lengkap" (tanggal lahir kosong), serta dicari berdasarkan nama. Filter SHALL tersimpan di alamat halaman. Jamaah tanpa tanggal lahir SHALL ditandai karena tidak akan masuk kegiatan yang memakai batas umur.

#### Scenario: Data belum lengkap
- **WHEN** admin Kelompok memilih filter "Data belum lengkap"
- **THEN** hanya jamaah tanpa tanggal lahir yang tampil, dengan keterangan bahwa mereka belum masuk kegiatan berbatas umur

#### Scenario: Admin Desa per kelompok
- **WHEN** Admin Desa memilih filter Kelompok "Citra"
- **THEN** hanya jamaah Kelompok Citra yang tampil
