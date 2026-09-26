# Proposal

## Why

Pencatatan kehadiran grup (kelas, kajian, dsb.) saat ini belum punya sistem yang bisa dipakai langsung oleh orang tua dari HP. Dibutuhkan web absensi mobile-first yang sangat mudah dipakai (pilih nama → tap status), dengan kategori, status, dan anggota yang fleksibel dikelola admin, serta riwayat dan laporan yang tidak hilang saat kehadiran di-reset. Referensi gaya: https://sisfo-baitulilmi.vercel.app (persentase per jenis kelamin, daftar nama beserta status).

## What Changes

- Aplikasi web baru (greenfield) berbasis React + Vite + Tailwind dengan backend Supabase (Postgres, Auth, Realtime), di-deploy ke Vercel.
- **Halaman pengguna (tanpa login)**: beranda berisi kartu kategori beserta % hadir; halaman kategori berisi pencarian nama, % hadir per L/P, daftar anggota dengan status; tap nama membuka bottom sheet status yang besar, 1 tap langsung tersimpan dan bisa diubah selama sesi aktif; pembaruan real-time.
- **PIN per kategori** yang bisa di-ON/OFF admin; PIN diverifikasi di server dan cukup dimasukkan sekali per perangkat.
- **Panel admin (`/admin`, login email+password tanpa pendaftaran)**:
  - CRUD kategori beserta pengaturan PIN.
  - CRUD status per kategori (label, warna, urutan, flag "dihitung hadir"); kategori baru otomatis mendapat status bawaan Hadir/Izin/Sakit/Alpa; status yang sudah dipakai diarsipkan, bukan dihapus.
  - Manajemen anggota global (nama, jenis kelamin) dengan keanggotaan banyak-ke-banyak ke kategori; mengeluarkan dari kategori berbeda dengan menghapus orang.
  - Import anggota massal dari `.xlsx` per kategori dengan template dan preview; import selalu membuat orang baru, duplikat di kategori tujuan dilewati secara default.
  - Reset kehadiran per kategori = menutup sesi aktif dan membuka sesi baru (riwayat tetap ada).
  - Laporan: rekap per sesi (per status × L/P) dan rekap per anggota lintas sesi, dengan ekspor `.xlsx`.
- Di luar cakupan v1: grafik tren, ekspor PDF/kirim WA, import multi-kategori dalam satu file, penggabungan data orang duplikat.

## Capabilities

### New Capabilities
- `admin-auth`: Login/logout admin dan pembatasan akses panel admin.
- `category-management`: CRUD kategori dan pengaturan PIN per kategori (on/off, ganti PIN).
- `attendance-status-management`: Status kehadiran per kategori, status bawaan, flag dihitung hadir, arsip status terpakai.
- `member-management`: Data orang global dan keanggotaan banyak-ke-banyak ke kategori.
- `member-import`: Import anggota massal dari `.xlsx` per kategori dengan template dan preview.
- `attendance-recording`: Alur publik: daftar kategori, daftar anggota, pencarian, verifikasi PIN, pengisian status, persentase hadir, pembaruan real-time.
- `attendance-sessions`: Sesi/periode per kategori dan reset kehadiran yang mempertahankan riwayat.
- `attendance-reports`: Rekap per sesi, rekap per anggota lintas sesi, dan ekspor `.xlsx`.

### Modified Capabilities
<!-- Tidak ada: proyek baru, belum ada spec. -->

## Impact

- Kode: repositori saat ini kosong; seluruh aplikasi frontend dan skema database dibuat baru.
- Dependensi baru: React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, `@supabase/supabase-js`, SheetJS (`xlsx`), Vitest.
- Sistem eksternal: proyek Supabase (Postgres + ekstensi `pgcrypto`, Auth, Realtime) dan hosting Vercel; variabel lingkungan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- Keamanan: anon key bersifat publik, sehingga seluruh penulisan publik wajib melalui fungsi server yang memverifikasi PIN; Row Level Security wajib aktif di semua tabel.
