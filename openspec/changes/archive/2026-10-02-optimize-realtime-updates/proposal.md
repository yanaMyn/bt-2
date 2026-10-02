# Proposal

## Why

Target pemakaian sekitar 1.000 jamaah dan puluhan admin. Pada skala itu, pembaruan real-time di halaman publik menjadi pemborosan terbesar.

- **Halaman kelompok** (`/g/...`) mendengarkan *semua* perubahan `attendance` dan `sessions` di seluruh Daerah, lalu memuat ulang seluruh daftar kegiatan untuk setiap perubahan.
- **Halaman kegiatan** (`/k/...`) juga menerima setiap isian di Daerah. Untuk isian di sesinya sendiri, ia memuat ulang seluruh peserta.
- **Saat sesi ditutup otomatis**, puluhan baris "Alpa" ditulis sekaligus. Setiap HP yang terbuka bisa memuat ulang puluhan kali dalam satu detik.

Akibatnya ada tiga hal:
- Transfer data mendekati batas paket gratis Supabase (5 GB/bulan).
- Database kecil (CPU bersama) tersendat saat penutupan sesi.
- Koneksi realtime yang dibiarkan terbuka di tab latar belakang menghabiskan kuota 200 koneksi bersamaan.

## What Changes

- **Halaman kegiatan:**
  - Hanya menerima perubahan isian dari sesi yang sedang dibuka (filter di server).
  - Status dan persentase diperbarui langsung dari data realtime tanpa memuat ulang daftar peserta.
  - Sinkronisasi penuh dilakukan sekali setelah rentetan perubahan mereda.
- **Halaman kelompok:**
  - Hanya menerima isian dari sesi berjalan yang tampil di halaman itu (filter di server), ditambah perubahan jadwal sesi.
  - Beberapa perubahan berdekatan digabung menjadi satu kali muat ulang.
- **Penutupan sesi:** rentetan isian otomatis tidak lagi memicu muat ulang berulang. Setiap HP cukup memuat ulang sekali.
- **Tab di latar belakang:** koneksi realtime diputus setelah tab tidak terlihat beberapa saat. Saat tab kembali terlihat, koneksi tersambung lagi dan data disegarkan.
- **Bila realtime gagal tersambung** (mis. kuota koneksi penuh pada acara besar), halaman tetap mutakhir lewat penyegaran berkala selama terlihat.
- Tidak ada perubahan database, alur pengisian, PIN, atau tampilan.

## Capabilities

### New Capabilities
- (tidak ada)

### Modified Capabilities
- `attendance-recording`: requirement "Pembaruan real-time" diperjelas:
  - batas waktu pembaruan;
  - cakupan halaman kelompok;
  - perilaku saat tab di latar belakang;
  - cadangan penyegaran berkala bila realtime tidak tersedia.

## Impact

- **Kode klien:**
  - `src/hooks/useRealtime.ts`: filter per event, status koneksi, jeda saat tab tersembunyi.
  - `src/features/public/CategoryPage.tsx` dan `src/features/public/KelompokPage.tsx`.
  - Helper baru di `src/lib/`: penggabung pemicu (debounce) dan penerapan perubahan isian ke cache.
- **Server:** tidak ada migrasi. Publikasi `supabase_realtime` untuk `attendance` dan `sessions` tetap dipakai.
- **Perkiraan dampak:** muat ulang dan pesan realtime turun sekitar 5–10×, sehingga paket gratis cukup untuk sekitar 1.000 jamaah.
- **Di luar cakupan:** backup database otomatis (diusulkan terpisah) dan peralihan ke Supabase Broadcast.
