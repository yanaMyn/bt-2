# Design

## Context

Lihat proposal.md untuk motivasi. Kondisi sekarang (migrasi 0001–0011):

- `sessions(session_date, note, label generated, started_at, closed_at)`. "Aktif" berarti `closed_at is null`, dijamin paling banyak satu per kategori oleh unique index parsial `sessions_one_active_key`.
- Penutupan manual lewat `end_session` (isi status otomatis, snapshot `session_members`, set `closed_at`); pembukaan lewat `start_session` (ditolak bila masih ada sesi aktif). `create_category` membuat sesi hari ini.
- `set_attendance`, `category_summary`, `session_stats`, dan `loadReportData` semuanya memakai "sesi dengan `closed_at is null`" sebagai sesi berjalan.
- Tidak ada proses terjadwal di database; semua perubahan dipicu request.

Dengan penjadwalan, banyak sesi berstatus belum ditutup sekaligus (dijadwalkan), dan waktu, bukan tombol, yang menentukan sesi mana yang berjalan.

## Goals / Non-Goals

**Goals:**
- Server tetap menjadi sumber kebenaran: pengisian ditolak tepat di luar jendela waktu, walaupun penutupan otomatis belum diproses.
- Penutupan otomatis memakai jalur kode yang sama dengan "Akhiri sesi" agar status otomatis dan snapshot konsisten.
- Tetap bekerja (dengan penundaan wajar) bila `pg_cron` belum aktif.

**Non-Goals:**
- Sesi melewati tengah malam, zona waktu selain WIB, pengingat/notifikasi.
- Pola berulang yang disimpan sebagai aturan (RRULE). Jadwal berulang langsung "dibuka" menjadi sesi-sesi biasa.

## Decisions

### D1. Kolom jam: `start_time`/`end_time` + kolom turunan `opens_at`/`closes_at`
Tambah `start_time time`, `end_time time`, `grace_hours smallint default 0 check (grace_hours in (0,6,12,24))`, serta `opens_at timestamptz`, `closes_at timestamptz` yang diisi trigger `BEFORE INSERT OR UPDATE`: `opens_at = (session_date + start_time) at time zone 'Asia/Jakarta'`, `closes_at = (session_date + end_time) at time zone 'Asia/Jakarta' + grace_hours * interval '1 hour'`. Constraint: jam keduanya null (sesi lama) atau keduanya terisi dengan `end_time > start_time`. Karena jam disimpan relatif terhadap `session_date`, mengubah tanggal otomatis memindahkan jendela waktu.
*Alternatif:* hanya menyimpan `timestamptz` mulai/selesai — mengubah tanggal lewat kalender harus menghitung ulang di klien dan rawan salah zona waktu; kolom generated tidak dipakai karena konversi zona waktu tidak immutable.

### D2. Keadaan sesi diturunkan dari waktu
- **selesai**: `closed_at is not null`, atau `closes_at <= now()`, atau sudah ada sesi lain di kategori yang sama yang dibuka setelahnya (tergantikan) — yang dua terakhir "selesai secara efektif" sampai difinalisasi (D3).
- **dijadwalkan**: `closed_at is null and opens_at > now()`.
- **berjalan**: selain itu. Sesi lama (`opens_at is null`) dianggap sudah dibuka pada `started_at`.

Fungsi `current_session(p_category_id)` (stable, security definer) mengembalikan satu sesi berjalan: belum ditutup, `coalesce(opens_at, started_at) <= now()`, `closes_at is null or closes_at > now()`, diurutkan `coalesce(opens_at, started_at) desc`, `limit 1`. Aturan "sesi terbaru menggantikan" otomatis terpenuhi karena yang terbaru dipilih. `set_attendance` memakai fungsi ini, sehingga penolakan tepat waktu tidak bergantung pada cron. Unique index `sessions_one_active_key` dihapus.

### D3. Finalisasi: `close_session` + `finalize_due_sessions` + `pg_cron`
- Logika penutupan `end_session` dipindah ke fungsi internal `close_session(p_session_id, p_closed_at)` (isi status otomatis untuk anggota yang belum mengisi, snapshot, set `closed_at`). `end_session` memanggilnya untuk `current_session`.
- `finalize_due_sessions()` menutup setiap sesi belum ditutup yang `closes_at <= now()` atau tergantikan sesi lain yang sudah dibuka; `closed_at` diisi waktu efektif (`least(closes_at, opens_at sesi pengganti)`), bukan waktu cron berjalan, supaya riwayat akurat.
- Dijadwalkan dengan `pg_cron` setiap menit. Migrasi mencoba `create extension if not exists pg_cron` + `cron.schedule` di dalam blok `exception` sehingga tetap lolos di PGlite atau bila ekstensi tidak tersedia.
- Cadangan tanpa cron: `set_attendance` memanggil `finalize_category(p_category_id)` sebelum menulis, dan panel admin memanggil RPC admin `finalize_due_sessions()` saat membuka tab Sesi/Laporan. Dengan begitu status otomatis tetap tertulis walau cron mati, hanya lebih lambat.
*Alternatif:* Edge Function terjadwal — butuh deploy terpisah; cron di Postgres sudah transaksional dan memakai fungsi yang sama.

### D4. RPC admin sesi
- `schedule_sessions(p_category_id, p_items jsonb)` — `[{date, start, end, grace, note}]`, 1–62 item, validasi per item, atomik; menggantikan `start_session` (dihapus). Mode "Satu sesi" mengirim satu item.
- `update_session(p_session_id, p_date, p_start, p_end, p_grace, p_note)` — jam & toleransi hanya boleh diubah untuk sesi dijadwalkan/berjalan; untuk sesi selesai hanya tanggal & catatan (jam lama dipertahankan).
- `delete_session(p_session_id)` — hanya sesi dijadwalkan tanpa catatan kehadiran.
- Policy `admin update` langsung pada `sessions` dicabut agar invarian waktu hanya diubah lewat RPC.
- `create_category` tidak lagi membuat sesi.

### D5. View & laporan
- `category_summary`: sesi berjalan diambil lewat `current_session(c.id)` (lateral), ditambah kolom `session_start_time`, `session_end_time`, `next_opens_at` (sesi dijadwalkan terdekat) dan `next_session_label`. Kolom lain tetap.
- `session_stats` dan `loadReportData` hanya memasukkan sesi yang sudah dibuka (`coalesce(opens_at, started_at) <= now()`). Tab Sesi admin tetap memuat semua sesi (termasuk dijadwalkan) lewat query terpisah.
- Anggota sesi berjalan yang tergantikan tetapi belum difinalisasi dihitung dari keanggotaan saat ini (sama dengan sesi berjalan).

### D6. Pembaruan tampilan tepat waktu di klien
Halaman publik & beranda menghitung batas berikutnya (jam mulai sesi berikutnya atau `closes_at` sesi berjalan) dari data yang sudah dimuat dan memasang `setTimeout` untuk memuat ulang query tepat setelah batas itu (+1 detik). Realtime pada `sessions` tetap menangkap perubahan dari admin/cron. Keputusan akhir tetap di server (D2).

### D7. Pembuatan jadwal berulang di klien
Fungsi murni `recurringDates(weekdays, from, to)` menghasilkan tanggal; `markDuplicates` menandai tanggal yang sudah memiliki sesi dengan `start_time` sama. Pratinjau berisi checkbox per tanggal; item tercentang dikirim ke `schedule_sessions`. Default rentang: hari ini (WIB) sampai akhir bulan ini.

### D8. Label & format jam
Label tanggal tetap dari `format_session_date`. Jam ditampilkan `HH.MM` (gaya Indonesia, mis. "19.30–21.00"); toleransi ditampilkan "+6 jam". Input memakai `<input type="time">` bawaan HP.

## Risks / Trade-offs

- [`pg_cron` belum diaktifkan di Supabase] → Penolakan pengisian tetap tepat waktu (D2); status otomatis ditulis saat ada pengisian atau admin membuka panel (D3). README menjelaskan cara mengaktifkan.
- [Keanggotaan berubah antara batas waktu dan finalisasi] → Jeda maksimal ±1 menit dengan cron; diterima.
- [Jam perangkat orang tua tidak akurat] → Hanya memengaruhi kapan tampilan berganti; server menolak/menerima berdasarkan jam server, dan pesan ditampilkan dari respons server.
- [Admin menjadwalkan sesi tumpang tindih di hari yang sama] → Diperbolehkan; sesi yang dibuka lebih akhir menggantikan (sesuai keputusan pengguna). Duplikat jam mulai yang sama ditandai di pratinjau.
- [Menghapus unique index sesi aktif] → Invarian dipindah ke logika `current_session`; diuji dengan test PGlite untuk dua sesi terbuka bersamaan.

## Migration Plan

Migrasi 0012 (tambah kolom & trigger, fungsi, view, RPC, pencabutan policy update, hapus `start_session`) dan 0013 (aktivasi `pg_cron`, boleh gagal diam-diam). Sesi lama tanpa jam tetap berlaku (D2). Setelah deploy: aktifkan `pg_cron` di Supabase (Database → Extensions) bila migrasi 0013 tidak berhasil mengaktifkannya, lalu jalankan ulang 0013. Rollback kode frontend dengan redeploy Vercel sebelumnya; migrasi bersifat maju-saja.

## Open Questions

- Apakah perlu opsi "salin jadwal bulan lalu"? Dapat ditambahkan kemudian tanpa mengubah spec ini.
