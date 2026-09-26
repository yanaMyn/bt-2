import { describe, expect, it } from 'vitest'
import { availableMonths, monthRecap, type ReportData } from './reports'
import type { Member, Session, Status } from './types'

const hadir: Status = { id: 'h', category_id: 'c', label: 'Hadir', color: '#16a34a', sort_order: 1, counts_as_present: true, archived_at: null }
const izin: Status = { id: 'i', category_id: 'c', label: 'Izin', color: '#eab308', sort_order: 2, counts_as_present: false, archived_at: null }

const members: Member[] = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, name: `Anggota ${i}`, gender: i < 5 ? 'L' : 'P' }))

function session(id: string, sessionDate: string, closed = true): Session {
  const at = `${sessionDate}T01:00:00Z`
  return { id, category_id: 'c', label: id, session_date: sessionDate, note: null, started_at: at, closed_at: closed ? at : null }
}

describe('monthRecap', () => {
  // 4 sesi bertanggal September, 1 sesi Oktober. Hadir per sesi: 9, 8, 7, 6 = 30.
  const sessions = [
    session('okt', '2026-10-05', false),
    session('s4', '2026-09-30'),
    session('s3', '2026-09-21'),
    session('s2', '2026-09-14'),
    session('s1', '2026-09-07'),
  ]
  const hadirCount: Record<string, number> = { s1: 9, s2: 8, s3: 7, s4: 6, okt: 10 }
  const data: ReportData = {
    category: { id: 'c', name: 'Kelas A', slug: 'kelas-a', pin_enabled: false, is_active: true, created_at: '' },
    statuses: [hadir, izin],
    sessions,
    members: new Map(members.map((m) => [m.id, m])),
    membersBySession: new Map(sessions.map((s) => [s.id, members.map((m) => m.id)])),
    attendanceBySession: new Map(
      sessions.map((s) => [
        s.id,
        new Map<string, string>([
          ...members.slice(0, hadirCount[s.id]).map((m) => [m.id, 'h'] as [string, string]),
          ...(s.id === 's1' ? [['m9', 'i'] as [string, string]] : []),
        ]),
      ]),
    ),
  }

  it('daftar bulan terbaru dulu, dikelompokkan menurut tanggal sesi', () => {
    expect(availableMonths(sessions)).toEqual(['2026-10', '2026-09'])
  })

  it('10 anggota × 4 sesi, 30 hadir = 75%', () => {
    const r = monthRecap(data, '2026-09')
    expect(r.sessions.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(r.rows.map((x) => [x.label, x.total])).toEqual([
      ['Hadir', 30],
      ['Izin', 1],
      ['Belum', 9],
    ])
    expect(r.stats.all).toEqual({ present: 30, total: 40, percent: 75 })
    expect(r.stats.L).toEqual({ present: 20, total: 20, percent: 100 })
    expect(r.members.rows).toHaveLength(10)
    expect(r.members.rows[0]).toMatchObject({ sessions: 4, present: 4, percent: 100 })
  })
})
