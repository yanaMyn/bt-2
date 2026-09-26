import { describe, expect, it } from 'vitest'
import { compareByMonth, compareBySession, maxSessionCount, type SessionStatRow } from './compare'

const cats = [
  { id: 'a', name: 'Kelompokan Citra', is_active: true },
  { id: 'b', name: 'Desaan CNT', is_active: true },
  { id: 'c', name: 'Kajian', is_active: false },
]

const row = (category_id: string, label: string, started_at: string, closed: boolean, present: number, total: number): SessionStatRow => ({
  session_id: `${category_id}-${label}`,
  category_id,
  label,
  session_date: started_at.slice(0, 10),
  note: null,
  started_at,
  closed_at: closed ? '2026-12-31T00:00:00Z' : null,
  month: started_at.slice(0, 7),
  present,
  total,
})

const stats = [
  row('a', 'Agustus', '2026-08-01T01:00:00Z', true, 5, 10),
  row('a', 'September', '2026-09-01T01:00:00Z', false, 9, 10),
  row('b', 'Minggu 1', '2026-09-01T01:00:00Z', true, 8, 10),
  row('b', 'Minggu 2', '2026-09-08T01:00:00Z', true, 6, 10),
  row('b', 'Minggu 3', '2026-09-15T01:00:00Z', false, 7, 10),
  row('c', 'September', '2026-09-02T01:00:00Z', false, 1, 4),
]

describe('compareBySession', () => {
  it('sesi aktif, diurutkan dari tertinggi', () => {
    const r = compareBySession(cats, stats, 0)
    expect(r.map((x) => [x.category.id, x.percent, x.detail])).toEqual([
      ['a', 90, 'September'],
      ['b', 70, 'Minggu 3'],
      ['c', 25, 'September'],
    ])
  })

  it('N sesi sebelumnya dihitung mundur per kategori; tanpa sesi di akhir', () => {
    expect(compareBySession(cats, stats, 1).map((x) => [x.category.id, x.percent, x.detail])).toEqual([
      ['b', 60, 'Minggu 2'],
      ['a', 50, 'Agustus'],
      ['c', null, null],
    ])
    expect(maxSessionCount(stats)).toBe(3)
  })
})

describe('compareByMonth', () => {
  it('menggabungkan semua sesi di bulan itu', () => {
    const r = compareByMonth(cats, stats, '2026-09')
    expect(r.map((x) => [x.category.id, x.present, x.total, x.percent, x.detail])).toEqual([
      ['a', 9, 10, 90, '1 sesi'],
      ['b', 21, 30, 70, '3 sesi'],
      ['c', 1, 4, 25, '1 sesi'],
    ])
    expect(compareByMonth(cats, stats, '2026-08').map((x) => [x.category.id, x.percent])).toEqual([
      ['a', 50],
      ['b', null],
      ['c', null],
    ])
  })
})
