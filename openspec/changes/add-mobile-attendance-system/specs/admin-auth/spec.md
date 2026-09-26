# Spec Delta

## Purpose

Membatasi seluruh fungsi pengelolaan (kategori, status, anggota, import, reset, laporan) hanya untuk admin yang sudah login, sementara halaman pengguna tetap publik.

## ADDED Requirements

### Requirement: Admin login dengan email dan password
Sistem SHALL menyediakan halaman login di `/admin/login` yang mengautentikasi admin menggunakan email dan password. Sistem SHALL NOT menyediakan pendaftaran akun mandiri; akun admin dibuat di luar aplikasi (dashboard Supabase).

#### Scenario: Login berhasil
- **WHEN** admin memasukkan email dan password yang valid lalu menekan "Masuk"
- **THEN** sistem mengarahkan admin ke dasbor `/admin`

#### Scenario: Login gagal
- **WHEN** admin memasukkan kredensial yang salah
- **THEN** sistem menampilkan pesan "Email atau password salah" dan tetap di halaman login

#### Scenario: Tidak ada pendaftaran
- **WHEN** pengunjung membuka halaman login
- **THEN** tidak ada tautan atau formulir pendaftaran akun

### Requirement: Proteksi halaman admin
Sistem SHALL mengarahkan pengunjung yang belum login dari semua rute `/admin/*` (selain `/admin/login`) ke halaman login. Sistem SHALL menolak semua operasi tulis admin di sisi server bila pemanggil tidak terautentikasi sebagai admin.

#### Scenario: Akses tanpa login
- **WHEN** pengunjung tanpa sesi login membuka `/admin/kategori`
- **THEN** sistem mengarahkan ke `/admin/login`

#### Scenario: Penulisan langsung tanpa autentikasi
- **WHEN** klien anonim mencoba membuat, mengubah, atau menghapus data kategori, status, anggota, atau sesi secara langsung ke database
- **THEN** server menolak operasi tersebut

### Requirement: Logout admin
Sistem SHALL menyediakan tombol logout yang mengakhiri sesi admin.

#### Scenario: Logout
- **WHEN** admin menekan "Keluar"
- **THEN** sesi berakhir dan admin diarahkan ke halaman beranda publik
