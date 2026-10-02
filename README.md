# Absensi

Web absensi mobile-first untuk orang tua: pilih Desa → Kelompok → kegiatan → cari & tap nama → tap status.
Struktur organisasi **Daerah → Desa → Kelompok**; tiap unit punya admin sendiri.

- Halaman publik: `/` (pilih Desa & Kelompok, diingat di perangkat), `/g/<kelompok>` (kegiatan kelompok itu,
  termasuk kegiatan Desa/Daerah yang mengikutkannya) dan `/k/<slug>` (daftar peserta).
- Panel admin: `/admin` (login **nama pengguna** + password).
  - **Admin Daerah**: struktur Desa & Kelompok, akun admin Desa, templat kegiatan, kegiatan Daerah, laporan semua.
  - **Admin Desa**: Kelompok di desanya, akun admin Kelompok, kegiatan Desa, laporan desanya.
  - **Admin Kelompok**: data jamaah (tambah/ubah/import/nonaktif/pindah), kegiatan Kelompok, laporan kelompoknya.
  - Peserta kegiatan dihitung otomatis dari kriteria (jenis kelamin, umur pada tanggal sesi, status nikah) dan
    wilayah; peserta dibekukan saat sesi ditutup.
- Stack: React + Vite + TypeScript + Tailwind, Supabase (Postgres, Auth, Realtime, Edge Functions), Vercel.
- Spesifikasi: `openspec/specs/` dan perubahan aktif di `openspec/changes/`.

## 1. Siapkan Supabase (paket Free cukup)

1. Buat proyek baru di <https://supabase.com/dashboard>.
2. Buka **SQL Editor**, lalu jalankan isi file di `supabase/migrations/` **satu per satu sesuai urutan nama file**.
   Alternatif lewat CLI: `npx supabase link --project-ref <ref>` lalu `npx supabase db push`.
3. (Opsional) jalankan `supabase/seed.sql` untuk data contoh.
4. **Matikan pendaftaran akun**: *Authentication → Sign In / Providers* → nonaktifkan
   *Allow new users to sign up*. **Jangan** matikan provider *Email* itu sendiri: akun nama pengguna disimpan
   sebagai email sintetis `<nama>@users.absensi.local` (tidak pernah dikirimi email).
   Hanya akun yang punya profil admin aktif yang bisa masuk panel admin.
5. Buat Admin Daerah pertama — lihat [Admin Daerah pertama](#admin-daerah-pertama).
6. Deploy Edge Function `admin-accounts` — lihat [Edge Function](#edge-function-admin-accounts).
7. Salin **Project URL** dan **anon / publishable key** dari *Project Settings → API*.

> Proyek paket Free di-pause otomatis bila tidak ada aktivitas sekitar 1 minggu.
> Buka dashboard Supabase dan tekan *Restore* bila aplikasi tiba-tiba tidak bisa memuat data. Data tidak hilang.

### Upgrade ke hierarki (migrasi 0014–0016)

> ⚠️ **Migrasi 0014 menghapus seluruh data lama**: kategori, anggota, sesi, dan isian kehadiran. Ekspor laporan
> yang masih dibutuhkan (`.xlsx`) **sebelum** menjalankannya. Akun login Supabase tidak dihapus.

Jalankan di SQL Editor, berurutan, masing-masing sekali:

1. `20260926000014_org_hierarchy_schema.sql` — tabel Daerah/Desa/Kelompok, profil admin, data jamaah baru,
   perpindahan, kegiatan dengan kriteria, templat.
2. `20260926000015_org_hierarchy_access.sql` — hak akses per level dan fungsi-fungsi admin.
3. `20260926000016_org_hierarchy_public_reports.sql` — halaman publik per kelompok dan laporan.
4. `20260926000017_transfer_details.sql` — data jamaah (nama, umur, status nikah) pada permintaan pindah
   untuk kelompok tujuan.
5. `20260926000018_transfer_notes.sql` — alasan (opsional) saat melepas jamaah dan saat menolak permintaan pindah.
6. `20260926000019_public_category.sql` — halaman kegiatan publik tetap tampil benar saat dibuka di browser yang
   sedang login sebagai admin unit lain.

Lalu buat Admin Daerah pertama dan deploy Edge Function (dua bagian di bawah). `supabase/seed.sql` (opsional,
data contoh) dijalankan **setelah** Admin Daerah dibuat.

### Admin Daerah pertama

1. *Authentication → Users → Add user*: isi email (boleh email lama, mis. akun admin yang sudah ada) dan password,
   centang *Auto Confirm User*.
2. Di SQL Editor jalankan (sekali saja; menolak bila Daerah sudah ada):

   ```sql
   select public.bootstrap_root_admin('email-akun-tadi@contoh.com', 'root', 'Nama Daerah');
   ```

3. Login di `/admin/login` dengan nama pengguna `root` (atau emailnya). Dari sini: menu **Struktur** untuk
   menambah Desa & Kelompok, menu **Admin** untuk membuat akun admin Desa. Admin Desa lalu membuat akun admin
   Kelompok. Akun baru memakai password sementara yang wajib diganti saat login pertama.

### Edge Function `admin-accounts`

Pembuatan akun, reset password, dan aktif/nonaktif akun admin berjalan di Edge Function karena butuh
*service role key* yang tidak boleh ada di browser. Kodenya di `supabase/functions/admin-accounts/`
(`index.ts` + `logic.ts`).

- **Lewat dashboard**: *Edge Functions → Deploy a new function → Via Editor*, beri nama persis `admin-accounts`,
  buat dua file `index.ts` dan `logic.ts` dengan isi dari folder tersebut, lalu *Deploy*. Biarkan
  *Verify JWT* aktif.
- **Lewat CLI**: `npx supabase functions deploy admin-accounts --project-ref <ref>`.

Tidak perlu mengisi secret: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` sudah tersedia
otomatis. Bila menu **Admin** menampilkan "Gagal memproses akun", periksa *Edge Functions → admin-accounts → Logs*.

### Sesi terjadwal & penutupan otomatis (`pg_cron`)

Setiap sesi punya tanggal, jam mulai–selesai (WIB), dan toleransi opsional (6/12/24 jam). Absen dibuka otomatis
pada jam mulai dan ditutup otomatis setelah jam selesai + toleransi; anggota yang belum mengisi dicatat dengan
"status otomatis saat sesi diakhiri" (default Alpa). Admin bisa menjadwalkan satu sesi atau berulang
(mis. setiap Senin & Kamis sebulan) di tab **Sesi** tiap kegiatan.

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
3. Deploy. `vercel.json` mengarahkan semua path ke `index.html` agar link seperti `/g/baitul-ilmi` atau
   `/k/remaja-baitul-ilmi` bisa dibuka langsung.

## Catatan keamanan

- Anon key memang publik. Klien anonim hanya bisa **membaca** struktur, kegiatan, dan nama + L/P peserta sesi
  berjalan (tanggal lahir & status nikah tidak pernah dikirim ke publik); satu-satunya jalur tulis publik adalah
  fungsi `set_attendance` yang memeriksa PIN kegiatan dan kepesertaan di server.
- Admin hanya bisa membaca data dalam cakupan unitnya (RLS); hanya admin Kelompok yang bisa mengubah jamaah.
- PIN kegiatan (4 digit) hanya bisa dibaca admin yang login dalam cakupan kegiatan itu (tombol mata di pengaturan)
  dan tidak pernah dikirim ke pengunjung publik. PIN hanya penghalang orang iseng, bukan autentikasi kuat;
  ganti PIN dari menu admin bila bocor.
