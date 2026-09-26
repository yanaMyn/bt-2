# Design

## Context

Repositori masih kosong (hanya OpenSpec), jadi ini proyek greenfield. Motivasi dan cakupan ada di `proposal.md`; perilaku yang harus dipenuhi ada di `specs/`. Batasan utama:

- Pengguna publik tanpa login, dipakai orang tua di HP, jadi UI harus sangat sederhana dan cepat.
- Backend Supabase: klien React memakai **anon key yang publik**, sehingga semua batas keamanan harus ditegakkan di database (RLS + fungsi Postgres), bukan di React.
- Data dipakai bersama banyak perangkat secara bersamaan (perlu realtime dan penulisan idempoten).

## Goals / Non-Goals

**Goals:**
- Satu SPA React yang melayani halaman publik (`/`, `/k/:slug`) dan panel admin (`/admin/*`).
- Seluruh aturan integritas (PIN, sesi aktif, status aktif milik kategori yang benar, atomisitas reset/import) ditegakkan di Postgres.
- Tanpa server backend sendiri: hanya Supabase + hosting statis Vercel.

**Non-Goals:**
- Offline-first / antrian penulisan saat offline.
- Multi-tenant / banyak organisasi; semua admin setara.
- Rate limiting tebakan PIN di luar yang disediakan Supabase (lihat Risks).

## Decisions

### D1. Stack frontend
React 18 + Vite + TypeScript + Tailwind CSS + React Router. Data fetching dengan `@supabase/supabase-js` dan TanStack Query untuk cache/invalidasi (mudah digabung dengan event realtime). SheetJS (`xlsx`) untuk import dan ekspor di browser.
*Alternatif:* Next.js — tidak perlu SSR, dan SPA statis lebih sederhana di-deploy; Firebase — relasional (laporan, join) lebih alami di Postgres.

### D2. Model data

```
categories(id, name UNIQUE, slug UNIQUE, pin_enabled bool, pin text NULL /* 4 digit, lihat D5 */, created_at)
statuses(id, category_id FK CASCADE, label, color, sort_order, counts_as_present bool,
         archived_at NULL)            -- UNIQUE(category_id, lower(label)) WHERE archived_at IS NULL
members(id, name, gender CHECK IN ('L','P'), created_at)
category_members(category_id FK CASCADE, member_id FK CASCADE, created_at,
                 PRIMARY KEY(category_id, member_id))
sessions(id, category_id FK CASCADE, session_date date, note text NULL /* <=200 */,
         label GENERATED (format_session_date(session_date)), started_at, closed_at NULL)
                                      -- UNIQUE(category_id) WHERE closed_at IS NULL
session_members(session_id FK CASCADE, member_id FK CASCADE, PRIMARY KEY(...))
attendance(session_id FK CASCADE, member_id FK CASCADE, status_id FK DEFERRABLE INITIALLY DEFERRED,
           updated_at, PRIMARY KEY(session_id, member_id))
```

- Unique index parsial menjamin **tepat satu sesi aktif** per kategori.
- `PRIMARY KEY(session_id, member_id)` menjamin satu status per anggota per sesi; penulisan memakai upsert.
- FK `status_id` dicek saat commit (deferred): status terpakai tetap tidak bisa dihapus langsung, tetapi penghapusan kategori yang meng-cascade ke `statuses` dan `sessions`→`attendance` sekaligus tidak gagal (dengan `RESTRICT`/`NO ACTION` urutan cascade membuatnya gagal). Penghapusan status lewat RPC yang memilih arsip vs hapus.

### D3. Siapa "anggota sebuah sesi" — snapshot saat sesi ditutup
Sesi aktif: anggota = baris `category_members` saat ini. Saat reset, keanggotaan saat itu disalin ke `session_members` untuk sesi yang ditutup; sesi tertutup memakai snapshot tersebut sebagai penyebut.
Ini memenuhi dua aturan spec sekaligus: orang yang dikeluarkan langsung hilang dari sesi aktif, sedangkan laporan sesi lama tetap memuatnya.
*Alternatif:* interval `joined_at/left_at` pada keanggotaan — lebih rumit (tumpang tindih interval, masuk-keluar berulang) dan tetap tidak konsisten untuk anggota yang dikeluarkan di tengah sesi.

### D4. Keamanan: RLS + fungsi `SECURITY DEFINER`
- RLS aktif di semua tabel.
- `anon`: hanya `SELECT` pada semua tabel. Karena Supabase memberi grant tingkat tabel secara default (yang membuat `REVOKE` per kolom tidak berpengaruh), grant pada `categories` dicabut lalu diberikan ulang per kolom: `anon` tanpa kolom `pin`, `authenticated` (admin) termasuk `pin`; klien publik selalu memilih kolom secara eksplisit.
- `authenticated` (admin): CRUD penuh via RLS `auth.role() = 'authenticated'`. Karena tidak ada signup (dimatikan di pengaturan Auth), setiap user terautentikasi adalah admin.
- Penulisan publik **hanya** lewat RPC:
  - `set_attendance(p_member_id, p_category_id, p_status_id NULL, p_pin text NULL)` → cek PIN (`p_pin = pin` bila `pin_enabled`), cek anggota ada di `category_members`, cek status aktif milik kategori, ambil sesi aktif di dalam fungsi (bukan dari klien — memenuhi "sesi tertutup read-only"), lalu upsert; `p_status_id NULL` menghapus baris (untuk "Batal" ke "Belum"). Error PIN dikembalikan dengan kode khusus (`PIN_REQUIRED` / `PIN_INVALID`).
  - `verify_category_pin(p_category_id, p_pin) → bool` untuk layar PIN sebelum sheet dibuka.
- RPC admin (dicek `auth.role() = 'authenticated'`): `create_category` (kategori + 4 status bawaan + sesi aktif, satu transaksi), `rename_category` (slug unik dibuat di SQL sehingga logika slug hanya ada di satu tempat), `set_category_pin`, `delete_status` (arsip bila terpakai, tolak bila status aktif terakhir), `reset_category` (snapshot → tutup → buka sesi baru, atomik), `import_members(p_category_id, p_rows jsonb)` (insert massal atomik; juga dipakai untuk "buat orang baru" satu per satu dari halaman kategori).
*Alternatif:* Edge Functions — menambah runtime terpisah; fungsi Postgres cukup dan otomatis transaksional.

### D5. PIN 4 digit, bisa dilihat admin
Awalnya PIN disimpan sebagai hash bcrypt. Setelah uji manual, admin perlu bisa melihat PIN yang aktif, sehingga PIN disimpan apa adanya di kolom `categories.pin` (tepat 4 digit) dengan grant kolom `SELECT` hanya untuk `authenticated`; `anon` tidak bisa membacanya. Hash tidak memberi perlindungan berarti untuk ruang 10.000 kombinasi, jadi kehilangannya kecil. Migrasi mematikan PIN kategori yang masih memakai hash lama karena nilainya tidak bisa dipulihkan.

### D5b. Kategori aktif/nonaktif
Kolom `categories.is_active` (default `true`). Kategori nonaktif disembunyikan di server: policy SELECT `anon` pada `categories` hanya `using (is_active)`, sehingga `category_summary` (security invoker) dan halaman `/k/:slug` ikut tidak melihatnya; `set_attendance` dan `verify_category_pin` menolaknya sebagai `CATEGORY_NOT_FOUND`. Admin (`authenticated`) tetap melihat semua kategori, jadi halaman publik juga menyaring `is_active` secara eksplisit agar admin yang sedang login melihat beranda yang sama dengan orang tua. Status, anggota, dan kehadiran kategori nonaktif tetap terbaca publik lewat tabelnya masing-masing (sama seperti keputusan gerbang PIN di tampilan).
*Alternatif:* hapus kategori — menghilangkan riwayat; arsip terpisah — tidak perlu untuk kebutuhan sembunyikan/tampilkan.

### D6. PIN di perangkat
Kategori ber-PIN menampilkan layar PIN sebagai gerbang halaman kategori (bukan per nama) sampai PIN benar. Gerbang ini hanya di tampilan: data baca tetap publik lewat RLS agar realtime dan beranda tetap sederhana; yang dilindungi server adalah penulisan. Setelah `verify_category_pin` sukses, PIN disimpan di `localStorage` dengan kunci `pin:<category_id>` dan dikirim di setiap `set_attendance`. Bila RPC mengembalikan `PIN_INVALID`/`PIN_REQUIRED`, kunci dihapus dan gerbang PIN tampil lagi. Akses `localStorage` dibungkus try/catch; bila gagal, PIN hanya disimpan di memori untuk sesi tab tersebut.

### D7. Perhitungan persentase — di klien dari data mentah
Satu kategori realistis berisi puluhan sampai beberapa ratus anggota, jadi halaman kategori memuat anggota + attendance sesi aktif + status sekaligus, lalu menghitung persentase di klien dengan satu fungsi murni (`computeStats`) yang juga dipakai laporan. Beranda memakai view `category_summary` (hadir, total, per gender untuk sesi aktif) agar tidak memuat semua anggota semua kategori.
*Alternatif:* semua lewat view — tetap dipakai untuk beranda; untuk halaman kategori data mentah tetap dibutuhkan untuk daftar.

### D8. Realtime
Supabase Realtime `postgres_changes` pada `attendance` (filter `session_id=eq.<aktif>` di halaman kategori, tanpa filter di beranda) dan `sessions` (untuk mendeteksi reset). Event memicu invalidasi query TanStack; pembaruan UI optimistik untuk perangkat yang menulis, rollback bila RPC gagal. Tabel perlu dimasukkan ke publication `supabase_realtime`, dan RLS SELECT anon memungkinkan event diterima.

### D9. "Batal" pada toast
Klien menyimpan status sebelumnya (bisa null) dan memanggil `set_attendance` lagi dengan nilai itu. Toast tampil ±5 detik.

### D10. Import `.xlsx`
Parsing dan klasifikasi (valid / tidak valid / duplikat) di browser dengan fungsi murni `classifyImportRows(rows, existingMembersInCategory)`. Normalisasi: `trim`, spasi berlebih diringkas, perbandingan `toLowerCase`. Baris tercentang dikirim ke RPC `import_members` sebagai JSON (satu transaksi). Template dibuat di klien dengan SheetJS (tidak perlu file statis).

### D11. Laporan
Query per kategori + sesi mengambil attendance, snapshot/keanggotaan, status (termasuk terarsip), lalu agregasi di klien dengan fungsi murni yang sama dengan D7. Rekap lintas sesi: untuk setiap sesi dalam rentang, anggota sesi = `session_members` (tertutup) atau `category_members` (aktif). Ekspor menulis array tabel yang sama ke workbook SheetJS; nama file dinormalisasi (spasi → `-`).

### D11b. Rekap per bulan & grafik antar kategori
- Bulan sebuah sesi = bulan `session_date` (lihat D11c). Rekap per bulan dihitung di klien dari `loadReportData` (D11) dengan fungsi murni `monthRecap`, yang memakai ulang aturan anggota-sesi D3 dan `memberRecap` untuk tabel per anggota.
- Grafik antar kategori butuh ringkasan semua sesi semua kategori. Daripada memuat seluruh catatan kehadiran ke browser, view `session_stats` (security invoker, migrasi 0007) menghitung per sesi: `total` anggota-sesi (snapshot `session_members` untuk sesi tertutup, `category_members` untuk sesi aktif), `present`, dan `month` (`YYYY-MM` dari `session_date`). Per sesi: klien mengurutkan sesi per kategori dari terbaru dan mengambil indeks N. Per bulan: jumlahkan `present`/`total` sesi di bulan itu per kategori.
- Batang digambar dengan elemen HTML/CSS biasa (tanpa library chart) agar bundle admin tidak bertambah dan label tetap terbaca di layar 360px; batang horizontal karena nama kategori panjang.

### D11c. Tanggal & catatan sesi
Label bebas diganti `session_date` (dipilih dari kalender) + `note` opsional. `label` menjadi kolom generated dari `format_session_date(session_date)` ("Sabtu, 26 September 2026"; fungsi immutable dengan nama hari/bulan Indonesia), sehingga semua kode yang menampilkan `label` tetap bekerja dan label tidak bisa diketik bebas. Bulan untuk rekap/grafik = bulan `session_date` (bukan `started_at`), karena tanggal sesi adalah tanggal kegiatan yang dipilih admin. Urutan "sesi aktif / N sebelumnya" tetap mengikuti siklus reset (`started_at`), karena sesi aktif selalu yang terakhir dibuka. Migrasi mengisi `session_date` dari `started_at` (WIB) dan memindahkan label lama yang bukan label bawaan ke `note`. `reset_category(p_category_id, p_date, p_note)` menggantikan versi berlabel; view `category_summary` & `session_stats` dibuat ulang karena bergantung pada kolom `label`.
*Alternatif:* tetap label bebas + validasi format — rawan tidak seragam, yang justru dikeluhkan.

### D12. Struktur folder

```
src/
  lib/supabase.ts, lib/stats.ts, lib/importXlsx.ts, lib/exportXlsx.ts, lib/pinStore.ts
  features/public/  (HomePage, CategoryPage, StatusSheet, PinPad)
  features/admin/   (Login, Layout, Categories, Statuses, Members, Import, Sessions, Reports)
  components/       (Toast, ConfirmDialog, StatBadge, ...)
supabase/migrations/  (skema, RLS, RPC, view)
```

### D13. Pengujian
Vitest untuk fungsi murni (`stats`, `importXlsx` classify, label sesi, normalisasi). Docker/Supabase CLI tidak tersedia di mesin pengembang, jadi migrasi dan fungsi SQL diuji dengan Vitest terhadap PGlite (Postgres WASM + `pgcrypto`) yang diberi stub minimal Supabase: schema `auth` dengan `auth.role()`/`auth.uid()` yang membaca `request.jwt.claims`, role `anon`/`authenticated`, dan publication `supabase_realtime`. Cakupan: cek PIN, sesi aktif, arsip status, reset atomik, RLS. Uji end-to-end memakai proyek Supabase cloud (paket Free). Verifikasi UI manual di viewport 360px.

## Risks / Trade-offs

- [Brute force PIN 4 digit lewat RPC publik] → Terima untuk v1 (PIN hanya penghalang orang iseng, bukan otentikasi kuat); fungsi menambahkan `pg_sleep(0.5)` pada PIN salah untuk memperlambat; admin bisa mengganti PIN kapan saja.
- [Siapa pun yang tahu PIN bisa mengisi status orang lain] → Sesuai desain (orang tua mengisi atas nama anak); toast + realtime membuat perubahan terlihat.
- [Semua user Auth adalah admin] → Signup dimatikan di Supabase; didokumentasikan di README.
- [Konflik dua perangkat menulis anggota yang sama] → Last-write-wins via upsert; realtime menyelaraskan tampilan.
- [Reset saat ada pengguna sedang mengisi] → `set_attendance` selalu menulis ke sesi aktif terbaru; halaman menerima event `sessions` dan memuat ulang.
- [Kategori sangat besar (ribuan anggota)] → Di luar ekspektasi; daftar tetap dirender sederhana, virtualisasi bisa ditambah nanti.
- [Paket gratis Supabase mem-pause proyek yang tidak aktif] → Didokumentasikan; admin cukup membuka dashboard.

## Migration Plan

Greenfield, tanpa migrasi data. Langkah deploy: buat proyek Supabase → jalankan file di `supabase/migrations` berurutan lewat SQL Editor (atau `npx supabase db push`) → matikan signup → buat akun admin → set env di Vercel → deploy. Rollback: redeploy build Vercel sebelumnya; migrasi skema bersifat maju-saja.
