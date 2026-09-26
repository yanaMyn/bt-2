import { normalizeRange, type DateRange } from './dateRange'

/** Batas sesi per sekali menjadwalkan (sama dengan server). */
export const MAX_SCHEDULE = 62

/** 0 = Minggu … 6 = Sabtu (sama dengan Date.getUTCDay). */
export const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toStr = (d: Date) => d.toISOString().slice(0, 10)

/** Semua tanggal (YYYY-MM-DD) dalam rentang inklusif yang jatuh pada hari terpilih. */
export function recurringDates(weekdays: readonly number[], range: DateRange): string[] {
  if (weekdays.length === 0) return []
  const { from, to } = normalizeRange(range.from, range.to)
  const days = new Set(weekdays)
  const out: string[] = []
  for (let d = toDate(from); toStr(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (days.has(d.getUTCDay())) out.push(toStr(d))
  }
  return out
}

export interface PlannedDate {
  date: string
  /** Sudah ada sesi di tanggal ini dengan jam mulai yang sama. */
  duplicate: boolean
}

/** Tandai tanggal yang sudah punya sesi dengan jam mulai sama ("19:30" vs "19:30:00"). */
export function markDuplicates(
  dates: readonly string[],
  startTime: string,
  existing: readonly { session_date: string; start_time: string | null }[],
): PlannedDate[] {
  const key = (date: string, time: string) => `${date}|${time.slice(0, 5)}`
  const taken = new Set(existing.filter((e) => e.start_time).map((e) => key(e.session_date, e.start_time!)))
  return dates.map((date) => ({ date, duplicate: taken.has(key(date, startTime)) }))
}
