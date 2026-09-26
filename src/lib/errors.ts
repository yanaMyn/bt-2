const MESSAGES: Record<string, string> = {
  PIN_REQUIRED: 'Masukkan PIN kegiatan terlebih dahulu.',
  PIN_INVALID: 'PIN salah.',
  PIN_FORMAT: 'PIN harus 4 digit angka.',
  NOT_MEMBER: 'Nama ini bukan anggota kegiatan ini.',
  INVALID_STATUS: 'Status tidak tersedia. Muat ulang halaman.',
  CATEGORY_NOT_FOUND: 'Kategori tidak ditemukan.',
  CATEGORY_NAME_TAKEN: 'Nama kegiatan sudah dipakai di unit ini.',
  LAST_ACTIVE_STATUS: 'Kategori harus memiliki minimal satu status aktif.',
  STATUS_NOT_FOUND: 'Status tidak ditemukan.',
  INVALID_ROW: 'Ada baris yang tidak valid. Tidak ada data yang disimpan.',
  NOT_ADMIN: 'Sesi admin berakhir. Silakan masuk lagi.',
  NOTE_TOO_LONG: 'Catatan maksimal 200 karakter.',
  NO_ACTIVE_SESSION: 'Tidak ada sesi yang sedang berjalan.',
  SESSION_ALREADY_ACTIVE: 'Masih ada sesi berjalan. Akhiri sesi aktif dulu.',
  INVALID_TIME: 'Jam selesai harus setelah jam mulai di hari yang sama.',
  INVALID_GRACE: 'Toleransi harus 0, 6, 12, atau 24 jam.',
  TOO_MANY_SESSIONS: 'Maksimal 62 sesi sekali jadwal. Persempit rentang tanggal.',
  SESSION_FINISHED: 'Jam sesi yang sudah selesai tidak bisa diubah.',
  SESSION_NOT_DELETABLE: 'Hanya sesi yang belum dimulai dan belum ada isian yang bisa dihapus. Gunakan "Akhiri sesi".',
  SESSION_NOT_FOUND: 'Sesi tidak ditemukan.',
  NOT_ALLOWED: 'Anda tidak berwenang melakukan ini.',
  NOT_PARTICIPANT: 'Nama ini bukan peserta kegiatan ini.',
  UNIT_NAME_TAKEN: 'Nama sudah dipakai di tempat yang sama.',
  UNIT_NAME_EMPTY: 'Nama wajib diisi.',
  UNIT_NOT_EMPTY: 'Masih ada isi di dalamnya.',
  UNIT_NOT_FOUND: 'Unit tidak ditemukan.',
  INVALID_PARENT: 'Induk unit tidak valid.',
  CATEGORY_NAME_EMPTY: 'Nama kegiatan wajib diisi.',
  INVALID_SCOPE: 'Pilih minimal satu wilayah peserta.',
  INVALID_AGE_RANGE: 'Rentang umur tidak valid (0–120, minimal ≤ maksimal).',
  INVALID_CRITERIA: 'Kriteria peserta tidak valid.',
  BIRTH_DATE_FUTURE: 'Tanggal lahir tidak boleh di masa depan.',
  INVALID_KELOMPOK: 'Kelompok tujuan tidak valid.',
  MEMBER_TRANSFER_PENDING: 'Jamaah ini sedang dalam permintaan pindah.',
  MEMBER_INACTIVE: 'Jamaah nonaktif tidak bisa dipindahkan.',
  TRANSFER_NOT_FOUND: 'Permintaan pindah tidak ditemukan atau sudah diputuskan.',
  INVALID_INACTIVE: 'Isi tanggal dan alasan nonaktif.',
  TRANSFER_NOTE_TOO_LONG: 'Alasan maksimal 500 karakter.',
  USERNAME_TAKEN: 'Nama pengguna sudah dipakai.',
  INVALID_USERNAME: 'Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah.',
  PASSWORD_TOO_SHORT: 'Password minimal 8 karakter.',
  DISPLAY_NAME_EMPTY: 'Nama tampilan wajib diisi.',
  CANNOT_TARGET_SELF: 'Tidak bisa mengubah akun Anda sendiri dari sini.',
  ACCOUNT_FAILED: 'Gagal memproses akun. Pastikan Edge Function admin-accounts sudah dipasang.',
  CREATE_FAILED: 'Gagal membuat akun.',
  UPDATE_FAILED: 'Gagal memperbarui akun.',
}

/** Kode error dari fungsi server (mis. "PIN_INVALID"), bila ada. */
export function errorCode(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg in MESSAGES ? msg : null
}

export function errorMessage(err: unknown, fallback = 'Terjadi kesalahan. Periksa koneksi lalu coba lagi.'): string {
  const code = errorCode(err)
  if (code) return MESSAGES[code]
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '23505') return 'Data dengan nama yang sama sudah ada.'
  return fallback
}
