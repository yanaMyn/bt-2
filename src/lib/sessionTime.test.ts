import { describe, expect, it } from 'vitest'
import {
  formatGrace,
  formatTimeRange,
  hasStarted,
  jakartaTime,
  msUntilNextBoundary,
  opensText,
  sessionState,
} from './sessionTime'

// Senin, 5 Oktober 2026 19.30–21.00 WIB + 6 jam => 12.30Z s.d. 20.00Z
const s = { closed_at: null, opens_at: '2026-10-05T12:30:00Z', closes_at: '2026-10-05T20:00:00Z' }

describe('sessionState', () => {
  it('dijadwalkan → berjalan → selesai menurut waktu', () => {
    expect(sessionState(s, new Date('2026-10-05T12:29:59Z'))).toBe('dijadwalkan')
    expect(sessionState(s, new Date('2026-10-05T12:30:00Z'))).toBe('berjalan')
    expect(sessionState(s, new Date('2026-10-05T19:59:59Z'))).toBe('berjalan')
    expect(sessionState(s, new Date('2026-10-05T20:00:00Z'))).toBe('selesai')
  })
  it('ditutup manual selalu selesai; sesi lama tanpa jam berjalan', () => {
    expect(sessionState({ ...s, closed_at: '2026-10-05T13:00:00Z' }, new Date('2026-10-05T12:40:00Z'))).toBe('selesai')
    expect(sessionState({ closed_at: null, opens_at: null, closes_at: null })).toBe('berjalan')
  })
  it('hasStarted', () => {
    expect(hasStarted(s, new Date('2026-10-05T12:00:00Z'))).toBe(false)
    expect(hasStarted({ opens_at: null })).toBe(true)
  })
})

describe('format', () => {
  it('jam, toleransi, dan teks buka', () => {
    expect(formatTimeRange('19:30:00', '21:00:00')).toBe('19.30–21.00')
    expect(formatTimeRange(null, null)).toBe('')
    expect(formatGrace(6)).toBe('+6 jam')
    expect(formatGrace(0)).toBe('')
    expect(jakartaTime('2026-10-05T12:30:00Z')).toBe('19.30')
    expect(opensText('Senin, 5 Oktober 2026', '2026-10-05T12:30:00Z')).toBe(
      'Absen dibuka Senin, 5 Oktober 2026 pukul 19.30',
    )
  })
})

describe('msUntilNextBoundary', () => {
  it('batas terdekat di masa depan + 1 detik', () => {
    const now = new Date('2026-10-05T12:00:00Z')
    expect(msUntilNextBoundary([s.opens_at, s.closes_at, null], now)).toBe(30 * 60 * 1000 + 1000)
    expect(msUntilNextBoundary(['2026-10-05T11:00:00Z'], now)).toBeNull()
  })
})
