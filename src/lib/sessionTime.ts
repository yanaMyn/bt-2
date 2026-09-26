export type SessionState = 'dijadwalkan' | 'berjalan' | 'selesai'

export interface TimedSession {
  closed_at: string | null
  opens_at: string | null
  closes_at: string | null
}

/**
 * Keadaan sesi menurut waktu (design D2). Sesi yang tergantikan sesi lain ditutup
 * server (finalize), jadi di klien cukup melihat closed_at/opens_at/closes_at.
 */
export function sessionState(s: TimedSession, now: Date = new Date()): SessionState {
  if (s.closed_at) return 'selesai'
  if (s.opens_at && new Date(s.opens_at) > now) return 'dijadwalkan'
  if (s.closes_at && new Date(s.closes_at) <= now) return 'selesai'
  return 'berjalan'
}

/** Sudah dibuka (berjalan atau selesai); sesi lama tanpa jam dianggap sudah dibuka. */
export function hasStarted(s: { opens_at: string | null }, now: Date = new Date()): boolean {
  return !s.opens_at || new Date(s.opens_at) <= now
}

/** "19:30:00" -> "19.30" */
export function formatTime(t: string): string {
  return t.slice(0, 5).replace(':', '.')
}

/** "19.30–21.00", atau '' untuk sesi tanpa jam. */
export function formatTimeRange(start: string | null, end: string | null): string {
  return start && end ? `${formatTime(start)}–${formatTime(end)}` : ''
}

export function formatGrace(hours: number | null | undefined): string {
  return hours ? `+${hours} jam` : ''
}

/** Jam (WIB) dari timestamp, mis. "19.30". */
export function jakartaTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('hour')}.${get('minute')}`
}

/** "Absen dibuka Senin, 5 Oktober 2026 pukul 19.30" */
export function opensText(label: string, opensAt: string): string {
  return `Absen dibuka ${label} pukul ${jakartaTime(opensAt)}`
}

/**
 * Milidetik sampai batas waktu terdekat di masa depan (+1 detik), untuk memuat ulang
 * tampilan tepat saat sesi dibuka/ditutup (design D6). null bila tidak ada.
 */
export function msUntilNextBoundary(
  times: readonly (string | null | undefined)[],
  now: Date = new Date(),
): number | null {
  let best: number | null = null
  for (const t of times) {
    if (!t) continue
    const diff = new Date(t).getTime() - now.getTime()
    if (diff > 0 && (best === null || diff < best)) best = diff
  }
  // setTimeout dibatasi ±24,8 hari; batas lebih jauh cukup dicek ulang nanti.
  return best === null ? null : Math.min(best + 1000, 2 ** 31 - 1)
}
