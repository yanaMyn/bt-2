import { describe, expect, it } from 'vitest'
import { compareByRange, type SessionStatRow } from './compare'

const cats = [
  { id: 'a', name: 'Kelompokan Citra', is_active: true },
  { id: 'b', name: 'Desaan CNT', is_active: true },
  { id: 'c', name: 'Kajian', is_active: false },
]

const row = (category_id: string, session_date: string, present: number, total: number): SessionStatRow => ({
  session_id: `${category_id}-${session_date}`,
  category_id,
  label: session_date,
  session_date,
  note: null,
  started_at: `${session_date}T01:00:00Z`,
  closed_at: null,
  month: session_date.slice(0, 7),
  present,
  total,
})

const stats = [
  row('a', '2026-08-29', 5, 10),
  row('a', '2026-09-26', 9, 10),
  row('b', '2026-09-05', 8, 10),
  row('b', '2026-09-12', 6, 10),
  row('b', '2026-09-26', 7, 10),
  row('c', '2026-09-02', 1, 4),
]

describe('compareByRange', () => {
  it('menggabungkan sesi dalam rentang dan mengurutkan dari tertinggi', () => {
    const r = compareByRange(cats, stats, { from: '2026-09-01', to: '2026-09-30' })
    expect(r.map((x) => [x.category.id, x.present, x.total, x.percent, x.detail])).toEqual([
      ['a', 9, 10, 90, '1 sesi'],
      ['b', 21, 30, 70, '3 sesi'],
      ['c', 1, 4, 25, '1 sesi'],
    ])
  })

  it('kategori tanpa sesi di tanggal itu ditaruh di akhir tanpa persentase', () => {
    const r = compareByRange(cats, stats, { from: '2026-09-26', to: '2026-09-26' })
    expect(r.map((x) => [x.category.id, x.percent])).toEqual([
      ['a', 90],
      ['b', 70],
      ['c', null],
    ])
  })
})
