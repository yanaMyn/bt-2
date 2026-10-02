# Design

## Context

Real-time memakai Supabase Realtime `postgres_changes` atas publikasi `supabase_realtime` (tabel `attendance` dan `sessions`, migrasi 0004). Langganan ada di dua halaman.

**`CategoryPage` (`/k/:slug`):**
- Mendengarkan semua event `attendance` tanpa filter, ditambah `sessions` dengan filter `category_id=eq.<id>`.
- Event isian dari sesi yang sedang tampil memicu `invalidateQueries`, yang memuat ulang seluruh data halaman: kegiatan, sesi berjalan dan berikutnya, status, RPC `public_activity_participants`, dan seluruh isian sesi.

**`KelompokPage` (`/g/:slug`):**
- Mendengarkan semua event `attendance` dan `sessions` tanpa filter.
- Setiap event memicu muat ulang RPC `public_kelompok_activities`. RPC ini menghitung peserta untuk setiap kegiatan.

Dua fakta lain yang memengaruhi desain:
- Untuk pengguna anonim, Realtime memeriksa izin setiap event untuk setiap pelanggan. Jadi biaya server sebanding dengan jumlah event × jumlah pelanggan.
- Event `DELETE` tidak bisa difilter di server. `old` hanya berisi kunci primer (`session_id`, `member_id`), dan itu cukup untuk menyaring di klien. `DELETE` hanya terjadi saat isian dibatalkan, jadi jarang.

`useNow` sudah memuat ulang tepat pada jam buka dan tutup sesi. React Query memuat ulang saat jendela kembali fokus.

## Goals / Non-Goals

**Goals:**
- Event yang sampai ke klien hanya yang relevan dengan halaman itu, karena disaring di server.
- Halaman kegiatan tidak memuat ulang seluruh data untuk setiap isian.
- Rentetan event (penutupan sesi) menghasilkan satu kali muat ulang per halaman.
- Koneksi tidak dihabiskan oleh tab di latar belakang.
- Ada cadangan penyegaran bila koneksi realtime gagal.

**Non-Goals:**
- Peralihan ke Supabase Broadcast atau trigger `realtime.broadcast_changes`.
- Perubahan skema, RPC, atau RLS.
- Backup database.
- Panel admin. Panel admin tidak memakai realtime dan dimuat ulang saat fokus atau sesudah aksi.

## Decisions

**D1 — Filter di server per halaman.**
- **Halaman kegiatan:**
  - `attendance` untuk `INSERT`/`UPDATE` dengan `session_id=eq.<sesi berjalan>`.
  - `attendance` untuk `DELETE` tanpa filter, disaring di klien dengan `old.session_id`.
  - `sessions` dengan `category_id=eq.<kegiatan>`.
  - Bila tidak ada sesi berjalan, hanya `sessions` yang didengarkan.
- **Halaman kelompok:**
  - `attendance` untuk `INSERT`/`UPDATE` dengan `session_id=in.(<id sesi berjalan yang tampil>)`, plus `DELETE` yang disaring di klien.
  - `sessions` tanpa filter. Perubahan jadwal jarang terjadi, dan kegiatan Desa/Daerah bisa menyertakan kelompok ini.
  - Daftar id berubah saat kartu berubah. Langganan dipasang ulang hanya bila himpunan id berubah.
- **Alternatif yang ditolak:** memfilter `sessions` per kegiatan di halaman kelompok. Kebutuhan banyak filter `in` atas `category_id` tidak sepadan, karena event sesi sedikit.

**D2 — Halaman kegiatan menambal cache, bukan memuat ulang.**
- Event `attendance` diterapkan ke `Map` isian di cache React Query lewat fungsi murni `applyAttendanceChange(map, event, sessionId)`:
  - `INSERT`/`UPDATE` mengisi `member_id → status_id`;
  - `DELETE` menghapusnya;
  - event dari sesi lain diabaikan.
- Persentase dihitung ulang dari cache seperti sekarang.
- Isian **tidak** memicu muat ulang. Sinkronisasi penuh hanya terjadi bila:
  - ada event `sessions` kegiatan ini (sesi berganti atau ditutup), dengan debounce 3 detik (maks. 10 detik);
  - halaman terlihat lagi (D6);
  - kanal pulih setelah gagal (D7);
  - jendela kembali fokus (bawaan React Query).

  Ini menangkap peserta baru atau event yang terlewat saat koneksi putus.
- **Alternatif yang ditolak:**
  - Muat ulang per event (perilaku sekarang).
  - Sinkronisasi penuh ter-debounce setelah *setiap* isian (rencana awal). Satu isian tunggal tetap berarti satu muat ulang per HP, sehingga penghematannya hanya terasa saat rentetan.

**D3 — Halaman kelompok memakai muat ulang ter-debounce.**
- Event tidak membawa informasi kelompok asal peserta, jadi hitungan per kelompok tidak bisa ditambal di klien.
- Setiap event yang lolos filter menjadwalkan satu kali muat ulang `public_kelompok_activities` dengan debounce 3 detik (maks. 10 detik).
- 40 isian "Alpa" saat penutupan sesi menghasilkan satu kali muat ulang.

**D4 — Helper `createDebouncer(fn, { wait, maxWait })`** di `src/lib/`.
- Murni, tanpa React. Mengembalikan `{ trigger, flush, cancel }` dan diuji dengan fake timers.
- Dibungkus hook `useDebouncedCallback` yang membatalkan diri saat unmount.

**D5 — `useRealtime` diperluas tanpa mengubah pemanggil lama.**
- Binding mendukung `event` (`'*' | 'INSERT' | 'UPDATE' | 'DELETE'`) dan `filter` opsional.
- Menerima `onStatus(status)` dari `channel.subscribe`.
- Nama kanal menyertakan kunci filter agar pemasangan ulang bersih.

**D6 — Jeda saat tab tersembunyi.**
- Hook `usePageVisible(graceMs = 60_000)` mengembalikan `false` setelah `document.visibilityState === 'hidden'` bertahan lebih dari 60 detik. Hook ini langsung `true` saat terlihat lagi.
- Halaman memberi `channelName = null` saat tidak terlihat, sehingga kanal dilepas.
- Saat terlihat lagi, kanal dipasang dan data dimuat ulang sekali.
- Jeda 60 detik mencegah sambung-putus saat pengguna hanya berpindah aplikasi sebentar.

**D7 — Cadangan polling.**
- Bila status kanal `CHANNEL_ERROR`, `TIMED_OUT`, atau `CLOSED` (bukan karena dilepas sendiri), halaman yang terlihat memakai `refetchInterval: 30_000`.
- Saat status kembali `SUBSCRIBED`, polling berhenti.
- Tidak ada pesan error ke pengguna.
- Supabase-js tetap mencoba menyambung ulang sendiri.

## Risks / Trade-offs

- **Filter `in` dibatasi jumlah nilai** (Supabase: maks. 100). Satu kelompok wajar punya < 20 sesi berjalan bersamaan. Bila melebihi 100, filter dilewati dan event disaring di klien.
- **Menambal cache bisa menyimpang** bila ada event yang terlewat. Sinkronisasi penuh ter-debounce (D2), muat ulang saat fokus, dan `useNow` membatasi penyimpangan ke hitungan detik.
- **Debounce menambah jeda tampilan hingga 3 detik** (maks. 10 detik saat rentetan) untuk persentase di halaman kelompok. Ini masih dalam target ≤ 5 detik untuk perubahan tunggal. Halaman kegiatan tetap seketika karena ditambal langsung.
- **Polling 30 detik saat kuota koneksi penuh** menambah request. Tetapi hanya untuk HP yang tidak mendapat koneksi, dan hanya selama halaman terlihat.
- **Event `DELETE` tetap tersiar ke semua pelanggan.** Jarang, dan isinya kecil.
