import { describe, expect, it } from 'vitest'
import { historySummary, type HistoryRow } from './memberHistory'

const row = (category: string, level: HistoryRow['owner_level'], present: boolean, id: string): HistoryRow => ({
  session_id: id,
  session_date: '2026-09-01',
  session_label: 'x',
  start_time: null,
  category_id: category,
  category_name: category,
  owner_level: level,
  owner_name: 'u',
  kelompok_id: 'k',
  kelompok_name: 'K',
  status_id: present ? 'h' : null,
  status_label: present ? 'Hadir' : null,
  status_color: null,
  counts_as_present: present,
})

describe('historySummary', () => {
  it('menghitung persentase per kegiatan lintas level dan totalnya', () => {
    const s = historySummary([
      row('Pengajian Daerah', 'daerah', true, '1'),
      row('Remaja', 'kelompok', true, '2'),
      row('Remaja', 'kelompok', false, '3'),
      row('Desaan', 'desa', false, '4'),
    ])
    expect(s.activities.map((a) => [a.category_name, a.sessions, a.present, a.percent])).toEqual([
      ['Remaja', 2, 1, 50],
      ['Desaan', 1, 0, 0],
      ['Pengajian Daerah', 1, 1, 100],
    ])
    expect([s.sessions, s.present, s.percent]).toEqual([4, 2, 50])
  })

  it('kosong = 0%', () => {
    expect(historySummary([])).toEqual({ activities: [], sessions: 0, present: 0, percent: 0 })
  })
})
