import { describe, expect, it } from 'vitest'
import { allRange, nearestDates, normalizeRange, presetRange, rangeLabel } from './dateRange'

describe('dateRange', () => {
  it('menukar rentang terbalik', () => {
    expect(normalizeRange('2026-09-30', '2026-09-01')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('preset relatif terhadap hari ini', () => {
    expect(presetRange('hari-ini', '2026-09-26')).toEqual({ from: '2026-09-26', to: '2026-09-26' })
    expect(presetRange('bulan-ini', '2026-09-26')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('bulan-lalu', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(presetRange('bulan-lalu', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(presetRange('bulan-ini', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('semua = tanggal sesi pertama sampai terakhir', () => {
    expect(allRange(['2026-09-12', '2026-08-01', '2026-09-26'])).toEqual({ from: '2026-08-01', to: '2026-09-26' })
    expect(allRange([])).toBeNull()
  })

  it('label satu tanggal dan rentang', () => {
    expect(rangeLabel({ from: '2026-09-26', to: '2026-09-26' })).toBe('Sabtu, 26 September 2026')
    expect(rangeLabel({ from: '2026-09-01', to: '2026-09-30' })).toBe('1 September 2026 sd 30 September 2026')
  })

  it('tanggal sesi terdekat di luar rentang', () => {
    const dates = ['2026-09-05', '2026-09-12', '2026-09-26']
    expect(nearestDates(dates, { from: '2026-09-15', to: '2026-09-20' })).toEqual({
      before: '2026-09-12',
      after: '2026-09-26',
    })
    expect(nearestDates(dates, { from: '2026-10-01', to: '2026-10-01' })).toEqual({ before: '2026-09-26', after: null })
  })
})
