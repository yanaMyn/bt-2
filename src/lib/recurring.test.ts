import { describe, expect, it } from 'vitest'
import { markDuplicates, recurringDates } from './recurring'

describe('recurringDates', () => {
  it('Senin & Kamis Oktober 2026 = 9 tanggal', () => {
    expect(recurringDates([1, 4], { from: '2026-10-01', to: '2026-10-31' })).toEqual([
      '2026-10-01',
      '2026-10-05',
      '2026-10-08',
      '2026-10-12',
      '2026-10-15',
      '2026-10-19',
      '2026-10-22',
      '2026-10-26',
      '2026-10-29',
    ])
  })
  it('rentang terbalik ditukar; tanpa hari = kosong', () => {
    expect(recurringDates([0], { from: '2026-10-10', to: '2026-10-01' })).toEqual(['2026-10-04'])
    expect(recurringDates([], { from: '2026-10-01', to: '2026-10-31' })).toEqual([])
  })
})

describe('markDuplicates', () => {
  it('menandai tanggal dengan jam mulai sama saja', () => {
    const r = markDuplicates(['2026-10-05', '2026-10-08'], '19:30', [
      { session_date: '2026-10-05', start_time: '19:30:00' },
      { session_date: '2026-10-08', start_time: '08:00:00' },
      { session_date: '2026-10-08', start_time: null },
    ])
    expect(r).toEqual([
      { date: '2026-10-05', duplicate: true },
      { date: '2026-10-08', duplicate: false },
    ])
  })
})
