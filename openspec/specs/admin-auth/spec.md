# admin-auth Specification

## Purpose

Membatasi seluruh fungsi pengelolaan (kategori, status, anggota, import, reset, laporan) hanya untuk admin yang sudah login, sementara halaman pengguna tetap publik.

## Requirements

### Requirement: Admin login dengan email dan password
Sistem SHALL menyediakan halaman login di `/admin/login` yang mengautentikasi admin menggunakan **nama pengguna** (atau email untuk akun yang dibuat dengan email) dan password. Sistem SHALL NOT menyediakan pendaftaran akun mandiri; akun admin dibuat oleh admin level di atasnya (lihat admin-accounts), kecuali akun Admin Daerah pertama. Akun admin nonaktif SHALL NOT dapat login.

#### Scenario: Login berhasil
- **WHEN** admin memasukkan nama pengguna (mis. "ahmad.baitulilmi") dan password yang valid lalu menekan "Masuk"
- **THEN** sistem mengarahkan admin ke dasbor `/admin` yang menampilkan nama unit dan levelnya

#### Scenario: Login gagal
- **WHEN** admin memasukkan kredensial yang salah
- **THEN** sistem menampilkan pesan "Nama pengguna atau password salah" dan tetap di halaman login

#### Scenario: Tidak ada pendaftaran
- **WHEN** pengunjung membuka halaman login
- **THEN** tidak ada tautan atau formulir pendaftaran akun

#### Scenario: Akun nonaktif
- **WHEN** admin yang akunnya dinonaktifkan mencoba login
- **THEN** sistem menolak dengan pesan bahwa akun dinonaktifkan dan meminta menghubungi admin di atasnya

### Requirement: Proteksi halaman admin
Sistem SHALL mengarahkan pengunjung yang belum login dari semua rute `/admin/*` (selain `/admin/login`) ke halaman login. Sistem SHALL menolak di sisi server semua operasi tulis admin bila pemanggil tidak terautentikasi sebagai admin aktif, dan SHALL membatasi baca maupun tulis data admin sesuai unit pemanggil (lihat admin-accounts). Menu panel admin SHALL hanya menampilkan fitur sesuai level admin.

#### Scenario: Akses tanpa login
- **WHEN** pengunjung tanpa sesi login membuka `/admin/kegiatan`
- **THEN** sistem mengarahkan ke `/admin/login`

#### Scenario: Penulisan langsung tanpa autentikasi
- **WHEN** klien anonim mencoba membuat, mengubah, atau menghapus data kegiatan, status, jamaah, unit organisasi, atau sesi secara langsung ke database
- **THEN** server menolak operasi tersebut

#### Scenario: Menu sesuai level
- **WHEN** admin Kelompok membuka panel admin
- **THEN** menu menampilkan Jamaah, Kegiatan, dan Laporan, tanpa menu Struktur, Admin, maupun Templat

### Requirement: Logout admin
Sistem SHALL menyediakan tombol logout yang mengakhiri sesi admin.

#### Scenario: Logout
- **WHEN** admin menekan "Keluar"
- **THEN** sesi berakhir dan admin diarahkan ke halaman beranda publik

### Requirement: Wajib ganti password
Akun admin yang baru dibuat atau yang password-nya direset SHALL diarahkan ke halaman ganti password setelah login dan SHALL NOT dapat membuka halaman admin lain sebelum menggantinya. Password baru SHALL minimal 8 karakter dan berbeda dari password sementara.

#### Scenario: Login pertama
- **WHEN** admin baru login dengan password sementara
- **THEN** sistem menampilkan halaman ganti password, dan setelah password diganti admin diarahkan ke dasbor

#### Scenario: Melewati ganti password
- **WHEN** admin yang wajib ganti password membuka `/admin/jamaah` secara langsung
- **THEN** sistem tetap menampilkan halaman ganti password

#### Scenario: Password baru terlalu pendek
- **WHEN** admin mengisi password baru kurang dari 8 karakter
- **THEN** sistem menolak dan menampilkan pesan validasi
