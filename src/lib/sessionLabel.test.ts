import { describe, expect, it } from 'vitest'
import { formatSessionDate, monthKey, monthLabel, sessionTitle, todayJakarta } from './sessionLabel'

describe('tanggal sesi', () => {
  it('memformat tanggal sama dengan server', () => {
    expect(formatSessionDate('2026-09-26')).toBe('Sabtu, 26 September 2026')
    expect(formatSessionDate('2026-10-01')).toBe('Kamis, 1 Oktober 2026')
    expect(formatSessionDate('2026-03-01')).toBe('Minggu, 1 Maret 2026')
  })

  it('hari ini mengikuti WIB', () => {
    expect(todayJakarta(new Date('2026-09-30T17:30:00Z'))).toBe('2026-10-01')
    expect(todayJakarta(new Date('2026-09-30T16:59:00Z'))).toBe('2026-09-30')
  })

  it('bulan dari tanggal sesi', () => {
    expect(monthKey('2026-09-30')).toBe('2026-09')
    expect(monthLabel('2026-09')).toBe('September 2026')
  })

  it('judul sesi menyertakan catatan bila ada', () => {
    expect(sessionTitle({ label: 'Sabtu, 26 September 2026', note: null })).toBe('Sabtu, 26 September 2026')
    expect(sessionTitle({ label: 'Sabtu, 26 September 2026', note: 'Tafsir' })).toBe('Sabtu, 26 September 2026 — Tafsir')
  })
})
