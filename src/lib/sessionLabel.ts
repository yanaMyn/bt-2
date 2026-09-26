const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Tanggal hari ini di WIB sebagai "YYYY-MM-DD" (nilai untuk input kalender). */
export function todayJakarta(at: Date = new Date()): string {
  // en-CA memformat tanggal sebagai YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(at)
}

/** "2026-09-26" -> "Sabtu, 26 September 2026" (sama dengan format_session_date di server). */
export function formatSessionDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]}, ${d} ${MONTHS[m - 1]} ${y}`
}

/** Label sesi beserta catatannya, mis. "Sabtu, 26 September 2026 — Kajian tafsir". */
export function sessionTitle(session: { label: string; note: string | null }): string {
  return session.note ? `${session.label} — ${session.note}` : session.label
}
