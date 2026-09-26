# Absensi

Web absensi mobile-first untuk orang tua: pilih kategori → cari & tap nama → tap status kehadiran.
Admin mengelola kategori, status, anggota, import `.xlsx`, reset kehadiran, dan laporan.

- Halaman publik: `/` (daftar kategori) dan `/k/<slug>` (daftar anggota).
- Panel admin: `/admin` (login email + password).
- Stack: React + Vite + TypeScript + Tailwind, Supabase (Postgres, Auth, Realtime), Vercel.
- Spesifikasi & desain: `openspec/changes/add-mobile-attendance-system/`.

## 1. Siapkan Supabase (paket Free cukup)

1. Buat proyek baru di <https://supabase.com/dashboard>.
2. Buka **SQL Editor**, lalu jalankan isi file di `supabase/migrations/` **satu per satu sesuai urutan nama file**.
   Alternatif lewat CLI: `npx supabase link --project-ref <ref>` lalu `npx supabase db push`.
3. (Opsional) jalankan `supabase/seed.sql` untuk data contoh.
4. **Matikan pendaftaran akun**: *Authentication → Sign In / Providers* → nonaktifkan
   *Allow new users to sign up*. **Jangan** matikan provider *Email* itu sendiri, karena admin login dengan email.
   Penting: setiap akun yang bisa login dianggap admin.
5. Buat akun admin: *Authentication → Users → Add user* (centang *Auto Confirm User*).
6. Salin **Project URL** dan **anon / publishable key** dari *Project Settings → API*.

> Proyek paket Free di-pause otomatis bila tidak ada aktivitas sekitar 1 minggu.
> Buka dashboard Supabase dan tekan *Restore* bila aplikasi tiba-tiba tidak bisa memuat data. Data tidak hilang.

### Sesi terjadwal & penutupan otomatis (`pg_cron`)

Setiap sesi punya tanggal, jam mulai–selesai (WIB), dan toleransi opsional (6/12/24 jam). Absen dibuka otomatis
pada jam mulai dan ditutup otomatis setelah jam selesai + toleransi; anggota yang belum mengisi dicatat dengan
"status otomatis saat sesi diakhiri" (default Alpa). Admin bisa menjadwalkan satu sesi atau berulang
(mis. setiap Senin & Kamis sebulan) di tab **Sesi** tiap kategori.

Penutupan otomatis dijalankan `pg_cron` setiap menit (migrasi `20260926000013_finalize_cron.sql`):

1. Jalankan migrasi 0013 di SQL Editor. Migrasi ini mencoba mengaktifkan `pg_cron` sendiri.
2. Cek di SQL Editor: `select jobname, schedule from cron.job;` harus menampilkan `finalize-sessions` dengan `* * * * *`.
3. Bila belum ada: aktifkan **Database → Extensions → pg_cron**, lalu jalankan ulang migrasi 0013.

Tanpa `pg_cron` aplikasi tetap aman: pengisian tetap ditolak tepat setelah batas waktu, dan Alpa dicatat saat ada
orang tua yang mengisi atau admin membuka tab Sesi — hanya tidak tepat pada menitnya.

## 2. Jalankan lokal

```bash
cp .env.example .env      # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

Bila `.env` belum diisi, aplikasi menampilkan layar "Konfigurasi belum lengkap".

## 3. Test

```bash
npm test          # semua test (unit + database)
npm run test:db   # hanya migrasi & fungsi SQL
```

Test database memakai [PGlite](https://pglite.dev) (Postgres WASM) dengan stub minimal Supabase
(`supabase/tests/harness.ts`), jadi tidak butuh Docker.

## 4. Deploy ke Vercel

1. Push repo ke GitHub lalu *Import Project* di Vercel (framework: Vite).
2. Isi *Environment Variables*: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` mengarahkan semua path ke `index.html` agar link seperti `/k/kelas-a` bisa dibuka langsung.

## Catatan keamanan

- Anon key memang publik. Klien anonim hanya bisa **membaca**; satu-satunya jalur tulis publik adalah fungsi
  `set_attendance` yang memeriksa PIN kategori di server.
- PIN kategori (4 digit) hanya bisa dibaca admin yang login (bisa dilihat lewat tombol mata di pengaturan kategori)
  dan tidak pernah dikirim ke pengunjung publik. PIN hanya penghalang orang iseng, bukan autentikasi kuat;
  ganti PIN dari menu admin bila bocor.
