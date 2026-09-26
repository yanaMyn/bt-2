const MESSAGES: Record<string, string> = {
  PIN_REQUIRED: 'Masukkan PIN kategori terlebih dahulu.',
  PIN_INVALID: 'PIN salah.',
  PIN_FORMAT: 'PIN harus 4 digit angka.',
  NOT_MEMBER: 'Nama ini bukan anggota kategori ini.',
  INVALID_STATUS: 'Status tidak tersedia. Muat ulang halaman.',
  CATEGORY_NOT_FOUND: 'Kategori tidak ditemukan.',
  CATEGORY_NAME_TAKEN: 'Nama kategori sudah dipakai.',
  CATEGORY_NAME_EMPTY: 'Nama kategori wajib diisi.',
  LAST_ACTIVE_STATUS: 'Kategori harus memiliki minimal satu status aktif.',
  STATUS_NOT_FOUND: 'Status tidak ditemukan.',
  INVALID_ROW: 'Ada baris yang tidak valid. Tidak ada data yang disimpan.',
  NOT_ADMIN: 'Sesi admin berakhir. Silakan masuk lagi.',
  NOTE_TOO_LONG: 'Catatan maksimal 200 karakter.',
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
