# Tasks

## 1. Setup proyek

- [x] 1.1 Scaffold Vite + React + TypeScript, pasang Tailwind, React Router, TanStack Query, `@supabase/supabase-js`, `xlsx`, Vitest; verifikasi `npm run dev` menampilkan halaman awal dan `npm run build` sukses
- [x] 1.2 Buat `src/lib/supabase.ts` yang membaca `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dan `.env.example`; verifikasi aplikasi menampilkan error jelas bila env kosong
- [x] 1.3 Buat folder `supabase/migrations/` dan harness uji SQL berbasis PGlite (Postgres WASM + `pgcrypto`, dengan stub schema `auth`, role `anon`/`authenticated`, dan fungsi `auth.role()`) yang menerapkan semua migrasi berurutan; verifikasi `npm run test:db` berjalan hijau dengan migrasi kosong
- [x] 1.4 Siapkan routing (`/`, `/k/:slug`, `/admin/login`, `/admin/*`) dengan layout mobile-first dan token warna di Tailwind; verifikasi tiap rute merender placeholder tanpa scroll horizontal di 360px

## 2. Skema database & keamanan

- [x] 2.1 Migrasi tabel `categories`, `statuses`, `members`, `category_members`, `sessions`, `session_members`, `attendance` beserta constraint dan unique index parsial (D2); verifikasi test PGlite: migrasi sukses dan insert sesi aktif kedua untuk kategori yang sama ditolak
- [x] 2.2 Aktifkan `pgcrypto`, RLS di semua tabel, policy SELECT anon, CRUD authenticated, dan cabut akses kolom `pin_hash` (grant per kolom); verifikasi test PGlite bahwa role anon tidak bisa INSERT/UPDATE/DELETE dan tidak bisa membaca `pin_hash`
- [x] 2.3 RPC `create_category` (kategori + 4 status bawaan + sesi aktif berlabel bulan-tahun, satu transaksi) dan `set_category_pin` (validasi 4–6 digit, hash bcrypt); verifikasi test PGlite: kategori baru punya 4 status & 1 sesi aktif, PIN non-digit ditolak
- [x] 2.4 RPC `verify_category_pin` dan `set_attendance` (cek PIN + `pg_sleep` saat salah, keanggotaan, status aktif milik kategori, sesi aktif diambil di server, upsert atau hapus bila status null, kode error `PIN_REQUIRED`/`PIN_INVALID`); verifikasi test PGlite untuk PIN benar/salah/nonaktif, status kategori lain ditolak, dan non-anggota ditolak
- [x] 2.5 RPC `delete_status` (hapus bila tak terpakai, arsip bila terpakai, tolak bila status aktif terakhir); verifikasi test PGlite untuk ketiga kasus
- [x] 2.6 RPC `reset_category` (snapshot `session_members`, tutup sesi, buka sesi baru dengan label parameter, atomik); verifikasi test PGlite: attendance lama tetap ada, snapshot berisi anggota saat itu, kategori lain tak berubah
- [x] 2.7 RPC `import_members(p_category_id, p_rows jsonb)` yang membuat orang baru + keanggotaan dalam satu transaksi; verifikasi test PGlite: baris gender invalid membatalkan seluruh import
- [x] 2.8 View `category_summary` (hadir/total keseluruhan dan per gender untuk sesi aktif); verifikasi test PGlite: hasil query sesuai contoh 77/82 = 94% pada data uji
- [x] 2.9 Tambahkan `attendance` dan `sessions` ke publication `supabase_realtime`; verifikasi test PGlite bahwa kedua tabel terdaftar di publication (penerimaan event diuji end-to-end di 4.8)

## 3. Logika bersama (fungsi murni)

- [x] 3.1 `src/lib/stats.ts` `computeStats` (hadir/total/persen keseluruhan & per L/P, pembulatan, 0/0 → 0%); verifikasi test Vitest untuk skenario 77/82→94%, 6 hadir dari 10 → 60%, dan penyebut nol
- [x] 3.2 `src/lib/pinStore.ts` (get/set/clear per kategori, fallback memori bila `localStorage` gagal); verifikasi test Vitest dengan `localStorage` yang melempar error
- [x] 3.3 Helper label sesi default (bulan-tahun bahasa Indonesia) untuk dialog reset (slug dibuat di SQL oleh `create_category`/`rename_category`, diuji di 2.3); verifikasi test Vitest ("September 2026")

## 4. Halaman publik

- [x] 4.1 Beranda `/`: kartu kategori dari `category_summary` (nama, %, "x/y hadir"), state kosong; verifikasi di browser 360px dengan data seed
- [x] 4.2 Halaman `/k/:slug`: label sesi, % keseluruhan/L/P, daftar anggota terurut dengan badge status atau "Belum", state slug tidak ditemukan; verifikasi di browser dengan data seed
- [x] 4.3 Pencarian nama langsung tanpa membedakan huruf besar/kecil + pesan "Nama tidak ditemukan"; verifikasi mengetik "bud" menyaring sesuai spec
- [x] 4.4 Komponen `PinPad` sebagai gerbang halaman kategori ber-PIN (keypad angka, `verify_category_pin`, simpan via `pinStore`, pesan "PIN salah", daftar anggota tersembunyi sampai PIN benar); verifikasi membuka kategori ber-PIN langsung meminta PIN sekali lalu tidak lagi setelah reload
- [x] 4.5 Bottom sheet `StatusSheet` (tombol ≥56px per status aktif sesuai urutan & warna, status saat ini ditandai), penyimpanan optimistik via `set_attendance`, rollback + pesan saat gagal; verifikasi tap status mengubah badge dan persentase
- [x] 4.6 Toast "Tersimpan" dengan "Batal" (kembali ke status sebelumnya, termasuk "Belum"); verifikasi manual di browser
- [x] 4.7 Tangani `PIN_INVALID`/`PIN_REQUIRED` dari `set_attendance` (hapus PIN tersimpan, tampilkan gerbang PIN lagi); verifikasi dengan mengganti PIN dari admin lalu mencoba mengisi
- [x] 4.8 Langganan realtime (`attendance` sesi aktif, `sessions`) yang meng-invalidasi query; verifikasi dua tab browser saling memperbarui dan reset admin langsung membuat semua "Belum"

## 5. Admin: autentikasi & kategori

- [x] 5.1 Halaman login email+password, guard rute `/admin/*`, tombol "Keluar"; verifikasi akses `/admin/kategori` tanpa login diarahkan ke login dan kredensial salah menampilkan pesan
- [x] 5.2 Daftar & CRUD kategori (buat via `create_category`, ubah nama + slug, hapus dengan konfirmasi ketik nama, validasi nama unik); verifikasi kategori baru muncul di beranda dengan 4 status
- [x] 5.3 Pengaturan PIN per kategori (toggle, input 4–6 digit, ganti PIN via `set_category_pin`); verifikasi toggle OFF membuat halaman publik tidak meminta PIN

## 6. Admin: status

- [x] 6.1 Halaman status per kategori: tambah/ubah label, warna (palet preset), flag dihitung hadir, urutan (naik/turun), validasi label unik; verifikasi perubahan tampil di bottom sheet publik kategori tersebut saja
- [x] 6.2 Hapus status via `delete_status` dengan pesan hasil (dihapus/diarsipkan/ditolak) dan tampilan status terarsip terpisah; verifikasi status terarsip hilang dari sheet tetapi tetap di laporan

## 7. Admin: anggota

- [x] 7.1 Halaman Anggota global: daftar + cari, ubah nama/gender, hapus orang (konfirmasi biasa bila tanpa riwayat, ketik nama bila ada riwayat); verifikasi perubahan nama tampil di semua kategori
- [x] 7.2 Tab anggota di halaman kategori: tambah orang yang sudah ada via pencarian, buat orang baru sekaligus menambahkan, keluarkan dari kategori, tolak keanggotaan ganda; verifikasi orang yang dikeluarkan hilang dari halaman publik kategori itu saja

## 8. Admin: import xlsx

- [x] 8.1 `src/lib/importXlsx.ts`: baca sheet pertama, cocokkan header, normalisasi gender, `classifyImportRows` (valid/tidak valid/duplikat terhadap kategori tujuan & dalam file); verifikasi test Vitest untuk variasi header, "Laki-laki"/"p", nama kosong, dan duplikat
- [x] 8.2 Tombol unduh template `.xlsx` yang dibuat di klien; verifikasi file terunduh dengan header "Nama" dan "Jenis Kelamin"
- [x] 8.3 Halaman import: pilih kategori, unggah (tolak non-`.xlsx`), tabel preview berwarna dengan checkbox (duplikat tidak tercentang default, tidak valid tidak bisa dicentang), konfirmasi ke `import_members`, ringkasan "N anggota ditambahkan"; verifikasi import file contoh menghasilkan jumlah anggota yang benar

## 9. Admin: sesi & reset

- [x] 9.1 Dialog reset per kategori (nama kategori, jumlah catatan, label sesi baru yang bisa diedit) memanggil `reset_category`; verifikasi halaman publik menjadi 0% dan sesi lama muncul di riwayat
- [x] 9.2 Halaman riwayat sesi (label, mulai, tutup, % hadir, penanda aktif, ubah label); verifikasi urutan terbaru di atas

## 10. Admin: laporan

- [x] 10.1 Rekap per sesi: pilih kategori + sesi, tabel status × L/P/total (termasuk status terarsip terpakai dan "Belum"), baris %, daftar anggota + status; anggota sesi dari snapshot/keanggotaan (D3); verifikasi angka cocok dengan halaman publik untuk sesi aktif
- [x] 10.2 Rekap per anggota lintas sesi dengan pilihan rentang sesi; verifikasi contoh Hadir 8 + Izin 1 dari 9 sesi → 89%, dengan test Vitest untuk fungsi agregasinya
- [x] 10.3 `src/lib/exportXlsx.ts` + tombol "Ekspor .xlsx" untuk kedua rekap (rekap sesi: sheet rekap + sheet daftar anggota; nama file `Kategori_Label.xlsx`); verifikasi file terbuka di Excel/Sheets dengan isi sama dengan tabel

## 11. Penyelesaian & deploy

- [x] 11.1 Seed data contoh `supabase/seed.sql` (2 kategori, ±20 anggota, 1 sesi tertutup) yang bisa dijalankan di SQL Editor Supabase; verifikasi test PGlite menerapkan seed tanpa error
- [x] 11.2 Uji menyeluruh alur publik dan admin di viewport 360px (tanpa scroll horizontal, teks ≥16px, tombol status ≥56px, status berlabel teks); catat hasilnya di checklist PR
- [x] 11.3 README: setup Supabase (pgcrypto, migrasi, matikan signup, buat akun admin), env var, deploy Vercel (termasuk rewrite SPA di `vercel.json`); verifikasi build produksi di Vercel dapat membuka `/k/:slug` secara langsung

## 12. Feedback uji manual: PIN 4 digit & lihat PIN

- [x] 12.1 Migrasi baru: kolom `pin` (tepat 4 digit) yang hanya bisa dibaca admin, hapus `pin_hash`, matikan PIN kategori yang masih memakai hash lama, `validate_pin`/`set_category_pin`/`check_category_pin` memakai PIN 4 digit; verifikasi test PGlite: anon tidak bisa membaca `pin`, admin bisa, PIN selain 4 digit ditolak
- [x] 12.2 Pengaturan PIN admin: input tepat 4 digit dan tampilan PIN saat ini dengan tombol mata (tersembunyi secara default), dengan pesan jelas bila PIN gagal dimuat atau masih PIN lama; verifikasi di browser PIN tampil setelah tombol mata ditekan
- [x] 12.3 Gerbang PIN publik: keypad 4 digit yang langsung memeriksa PIN saat digit ke-4 ditekan; verifikasi di browser PIN benar membuka daftar dan PIN salah mengosongkan keypad

## 13. Feedback uji manual: kategori aktif/nonaktif

- [x] 13.1 Migrasi `is_active` (default true), policy SELECT anon hanya kategori aktif, kolom `is_active` di `category_summary`, RPC admin `set_category_active`, dan `set_attendance`/`verify_category_pin` menolak kategori nonaktif; verifikasi test PGlite: anon tidak melihat kategori nonaktif (tabel & ringkasan), admin tetap melihat, penulisan ditolak, data tetap utuh setelah diaktifkan lagi
- [x] 13.2 Halaman publik menyaring kategori aktif secara eksplisit (beranda & `/k/:slug`); verifikasi di browser kategori nonaktif hilang dari beranda dan `/k/<slug>` menampilkan "Kategori tidak ditemukan", termasuk saat admin sedang login
- [x] 13.3 Admin: saklar "Aktif" di tab Pengaturan dan penanda "Nonaktif" di daftar & detail kategori; verifikasi di browser menonaktifkan lalu mengaktifkan kembali mengembalikan kartu dengan data yang sama

## 14. Rekap per bulan & grafik perbandingan kategori

- [x] 14.1 Migrasi view `session_stats` (per sesi: total, present, month WIB); verifikasi test PGlite: angka sama dengan `sessionRecap` untuk sesi aktif & tertutup, dan sesi 30 Sep 23:00 WIB masuk September
- [x] 14.2 Fungsi murni `monthRecap` (daftar bulan, tabel status × L/P, % hadir, tabel per anggota) dan agregasi grafik `compareCategories` (per sesi indeks N, per bulan); verifikasi test Vitest untuk skenario 30/40 = 75%, kategori tanpa sesi, dan urutan tertinggi
- [x] 14.3 ~~Tab "Per bulan" di Laporan~~ — digantikan tab Rekap berbasis kalender (16.3) sebelum diverifikasi
- [x] 14.4 ~~Tab "Grafik" mode per sesi/per bulan~~ — digantikan grafik berbasis kalender (16.3) sebelum diverifikasi

## 15. Feedback: tanggal sesi dari kalender + catatan

- [x] 15.1 Migrasi: `session_date` + `note` (<=200), `label` generated dari `format_session_date`, isi data lama (tanggal dari `started_at` WIB, label lama non-bawaan ke `note`), `create_category` memakai tanggal hari ini, `reset_category(p_category_id, p_date, p_note)`, view `category_summary`/`session_stats` dibuat ulang dengan `month` dari `session_date`; verifikasi test PGlite: label "Sabtu, 26 September 2026", migrasi data lama, catatan >200 ditolak, rekap bulan mengikuti `session_date`
- [x] 15.2 Klien: tipe & helper tanggal (hari ini WIB, format label), `monthRecap`/`availableMonths` memakai `session_date`, ekspor menyertakan catatan; verifikasi test Vitest
- [x] 15.3 Admin: dialog reset dengan kalender (default hari ini) + catatan dan pratinjau label; riwayat sesi menampilkan catatan dan "Ubah tanggal/catatan" lewat kalender; laporan menampilkan catatan; verifikasi di browser
- [x] 15.4 Halaman kategori publik menampilkan label tanggal + catatan sesi aktif; verifikasi di browser
- [x] 15.5 Perbarui `supabase/seed.sql` ke skema tanggal sesi; verifikasi test PGlite seed

## 16. Feedback: otomatis Alpa saat reset & laporan berbasis kalender

- [x] 16.1 Migrasi `categories.reset_status_id` + RPC `set_reset_status`, isi awal dari status "Alpa", `create_category` mengatur Alpa, `delete_status` mengosongkan bila diarsipkan, `reset_category` mengisi anggota snapshot yang belum mengisi; verifikasi test PGlite: reset mengisi Alpa hanya untuk yang belum mengisi, "Tidak ada" tetap Belum, status kategori lain ditolak, arsip mengosongkan pengaturan
- [x] 16.2 Fungsi murni `rangeRecap`, `compareByRange`, preset tanggal (hari ini/bulan ini/bulan lalu/semua), sesi terdekat, label rentang untuk nama file; verifikasi test Vitest (75% rentang, satu sesi, tanpa sesi, preset di akhir bulan)
- [x] 16.3 Laporan: komponen pemilih Tanggal/Rentang dengan kalender & preset; tab Rekap (gabungan + daftar status bila satu sesi + sesi terdekat bila kosong), Per anggota, Grafik; hapus tab Per sesi/Per bulan; ekspor; verifikasi di browser di layar 360px
- [x] 16.4 Admin: pengaturan "Status otomatis saat reset" di tab Status dan jumlah anggota yang akan dicatat otomatis di dialog reset; verifikasi di browser reset mengubah "Belum" menjadi Alpa di laporan sesi yang ditutup

## 17. Feedback: pisahkan "Akhiri sesi" dan "Buat sesi baru"

- [x] 17.1 Migrasi: RPC `end_session` & `start_session`, `reset_category` menjadi pembungkus, `set_attendance` menolak `NO_ACTIVE_SESSION`, `category_summary` left join sesi aktif; verifikasi test PGlite: akhiri mengisi Alpa & meninggalkan kategori tanpa sesi, pengisian ditolak, sesi kedua ditolak, kategori tanpa sesi tetap di ringkasan
- [x] 17.2 Admin tab Sesi: tombol "Buat sesi baru" terpisah (kalender + catatan, nonaktif bila ada sesi aktif), "Akhiri sesi" di baris sesi aktif di sebelah "Ubah tanggal/catatan" dengan dialog jumlah Alpa; hapus kartu "Reset kehadiran"; verifikasi di browser
- [x] 17.3 Publik: beranda "Belum ada sesi berjalan" & halaman kategori "Sesi sudah diakhiri…" saat tanpa sesi aktif; verifikasi di browser

## 18. Feedback: aksi massal di tab Anggota

- [x] 18.1 Migrasi RPC admin `remove_members_from_category`, `delete_members`, `members_with_history` (array id, atomik); verifikasi test PGlite: keluarkan massal, hapus massal beserta riwayat, hitung riwayat, anon ditolak
- [x] 18.2 UI pilih banyak (centang per baris, "Pilih semua" hasil pencarian, bilah aksi "N dipilih") di tab Anggota kategori (Keluarkan / Hapus orang) dan menu Anggota (Hapus orang), konfirmasi ketik "HAPUS" bila ada riwayat; verifikasi di browser

## 19. Feedback: pagination daftar anggota admin

- [x] 19.1 Helper murni `paginate` (potong halaman, jumlah halaman, rentang "26–50 dari 120", halaman di luar batas dijepit) dan penyimpanan ukuran halaman per perangkat; verifikasi test Vitest
- [x] 19.2 Komponen pagination (10/25/50, sebelumnya/berikutnya, keterangan posisi) di tab Anggota kategori & menu Anggota; "Pilih semua" untuk seluruh hasil pencarian; kembali ke halaman 1 saat cari/ganti ukuran; verifikasi di browser

## 20. Feedback: filter kategori di menu Anggota

- [x] 20.1 Fungsi murni `filterMembers` (nama + kategori / tanpa kategori) dan dropdown filter di menu Anggota (tersimpan di URL, reset ke halaman 1); verifikasi test Vitest dan di browser

