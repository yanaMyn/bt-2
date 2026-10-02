## MODIFIED Requirements

### Requirement: Pembaruan real-time
Halaman kelompok dan halaman kegiatan SHALL memperbarui status dan persentase secara otomatis ketika data kehadiran berubah dari perangkat lain, tanpa pengguna memuat ulang halaman, paling lambat beberapa detik (target ≤ 5 detik) setelah perubahan tersimpan. Halaman kegiatan SHALL hanya bereaksi terhadap perubahan pada sesi yang sedang ditampilkannya, dan halaman kelompok SHALL hanya bereaksi terhadap perubahan pada sesi berjalan dari kegiatan yang ditampilkannya serta perubahan jadwal sesi; perubahan di kegiatan lain SHALL NOT memicu pengambilan data ulang. Banyak perubahan yang terjadi berdekatan (mis. saat sesi ditutup dan status otomatis dicatat untuk banyak peserta) SHALL menghasilkan paling banyak satu kali pengambilan data ulang per halaman per rentetan. Saat halaman tidak terlihat (tab di latar belakang atau layar mati) lebih dari satu menit, halaman SHALL berhenti menerima pembaruan langsung, dan saat kembali terlihat SHALL langsung menampilkan data terbaru. Bila pembaruan langsung tidak dapat tersambung (mis. kuota koneksi penuh), halaman yang terlihat SHALL tetap menyegarkan datanya secara berkala (paling lama setiap 30 detik) tanpa menampilkan error kepada pengguna.

#### Scenario: Dua perangkat
- **WHEN** perangkat A dan B membuka `/k/kelas-a` dan perangkat A mengisi Budi "Hadir"
- **THEN** perangkat B menampilkan Budi "Hadir" dan persentase terbaru dalam beberapa detik

#### Scenario: Isian di kegiatan lain tidak memicu muat ulang
- **WHEN** perangkat B membuka halaman Kegiatan Remaja Baitul Ilmi dan ada isian baru di Pengajian Ibu-ibu Citra
- **THEN** perangkat B tidak mengambil data ulang dan tampilannya tidak berubah

#### Scenario: Penutupan sesi
- **WHEN** sesi berjalan ditutup otomatis dan 40 peserta yang belum mengisi dicatat "Alpa" sekaligus
- **THEN** setiap perangkat yang membuka halaman kegiatan atau kelompok terkait menampilkan keadaan akhir sesi setelah paling banyak satu kali pengambilan data ulang

#### Scenario: Kembali dari latar belakang
- **WHEN** pengguna meninggalkan halaman kegiatan di tab latar belakang selama 10 menit lalu membukanya lagi
- **THEN** halaman langsung menampilkan status dan persentase terbaru tanpa pengguna memuat ulang

#### Scenario: Pembaruan langsung tidak tersedia
- **WHEN** halaman kegiatan terbuka tetapi koneksi pembaruan langsung ditolak karena kuota penuh
- **THEN** halaman tetap menampilkan isian dari perangkat lain paling lama sekitar 30 detik kemudian, tanpa pesan error
