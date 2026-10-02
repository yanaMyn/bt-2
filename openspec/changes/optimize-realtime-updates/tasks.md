# Tasks

## 1. Helper murni

- [x] 1.1 `createDebouncer(fn, { wait, maxWait })` di `src/lib/debounce.ts` dengan `trigger`/`flush`/`cancel` (D4); verifikasi test Vitest dengan fake timers: rentetan 40 pemicu dalam 2 detik = 1 panggilan, `maxWait` memaksa panggilan saat pemicu terus berdatangan, `cancel` mencegah panggilan
- [x] 1.2 `applyAttendanceChange(map, event, sessionId)` di `src/lib/realtimeAttendance.ts` (D2): INSERT/UPDATE mengisi, DELETE menghapus (memakai `old`), event sesi lain diabaikan, map asli tidak diubah; verifikasi test Vitest

## 2. Hook

- [x] 2.1 Perluas `useRealtime`: binding dengan `event` dan `filter` opsional, callback `onStatus`, kanal dilepas saat nama `null` (D5); pemanggil lama tetap jalan; verifikasi typecheck dan test unit yang ada tetap lulus
- [x] 2.2 `usePageVisible(graceMs)` (D6) dan `useDebouncedCallback` (pembungkus D4, batal saat unmount); verifikasi test Vitest untuk logika visibilitas (tersembunyi < 60 detik tetap `true`, > 60 detik `false`, terlihat lagi langsung `true`)

## 3. Halaman

- [x] 3.1 Halaman kegiatan (`/k/:slug`): filter `session_id=eq.` + DELETE disaring klien + `sessions` per kegiatan (D1), tambal cache dengan `applyAttendanceChange` tanpa muat ulang, sinkronisasi penuh ter-debounce 3 detik (maks. 10) hanya untuk perubahan sesi / terlihat lagi / kanal pulih, jeda saat tersembunyi + muat ulang saat terlihat (D6), polling 30 detik saat kanal gagal (D7); verifikasi di browser dengan dua perangkat: isian muncul seketika tanpa request ulang daftar peserta (tab Network), isian di kegiatan lain tidak memicu request
- [x] 3.2 Halaman kelompok (`/g/:slug`): filter `session_id=in.(…)` untuk sesi berjalan yang tampil (lewati filter bila > 100), `sessions` tanpa filter, muat ulang ter-debounce 3 detik (maks. 10), jeda saat tersembunyi, polling 30 detik saat kanal gagal (D1, D3, D6, D7); verifikasi di browser: isian di kelompok lain yang tidak terkait tidak memicu request, isian terkait memperbarui persentase ≤ 5 detik

## 4. Verifikasi menyeluruh

- [x] 4.1 Penutupan sesi: akhiri sesi berisi banyak peserta yang belum mengisi sementara 2 perangkat membuka halaman kegiatan dan halaman kelompok; verifikasi di tab Network tiap perangkat hanya ada satu kali muat ulang untuk rentetan itu dan tampilan akhir benar
- [x] 4.2 Latar belakang & cadangan: tinggalkan halaman > 1 menit di tab latar belakang lalu kembali (data terbaru langsung tampil; di Supabase *Realtime → Inspector*/log koneksi terlepas saat tersembunyi); simulasikan realtime gagal (mis. blokir WebSocket di DevTools) dan pastikan isian dari perangkat lain muncul ≤ 30 detik tanpa pesan error
- [x] 4.3 `npm run typecheck`, `npm test`, dan `npm run build` lulus
