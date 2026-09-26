import { formatSessionDate } from './sessionLabel'

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

/** Rentang tanggal inklusif, "YYYY-MM-DD". from === to berarti satu tanggal. */
export interface DateRange {
  from: string
  to: string
}

export type Preset = 'hari-ini' | 'bulan-ini' | 'bulan-lalu'

export function normalizeRange(from: string, to: string): DateRange {
  return from <= to ? { from, to } : { from: to, to: from }
}

export function isSingleDay(r: DateRange): boolean {
  return r.from === r.to
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Rentang untuk tombol cepat, relatif terhadap `today` (YYYY-MM-DD, WIB). */
export function presetRange(preset: Preset, today: string): DateRange {
  const [y, m] = today.split('-').map(Number)
  if (preset === 'hari-ini') return { from: today, to: today }
  const [year, month] = preset === 'bulan-ini' ? [y, m] : m === 1 ? [y - 1, 12] : [y, m - 1]
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}` }
}

/** Rentang yang mencakup semua tanggal sesi, atau null bila belum ada sesi. */
export function allRange(dates: readonly string[]): DateRange | null {
  if (dates.length === 0) return null
  const sorted = [...dates].sort()
  return { from: sorted[0], to: sorted.at(-1)! }
}

/** "1 September 2026" */
export function formatDateShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "Sabtu, 26 September 2026" untuk satu tanggal; "1 September 2026 sd 30 September 2026" untuk rentang. */
export function rangeLabel(r: DateRange): string {
  return isSingleDay(r) ? formatSessionDate(r.from) : `${formatDateShort(r.from)} sd ${formatDateShort(r.to)}`
}

export function inRange(date: string, r: DateRange): boolean {
  return date >= r.from && date <= r.to
}

/** Tanggal sesi terdekat sebelum dan sesudah rentang (untuk saran saat rentang kosong). */
export function nearestDates(dates: readonly string[], r: DateRange): { before: string | null; after: string | null } {
  let before: string | null = null
  let after: string | null = null
  for (const d of dates) {
    if (d < r.from && (before === null || d > before)) before = d
    if (d > r.to && (after === null || d < after)) after = d
  }
  return { before, after }
}
