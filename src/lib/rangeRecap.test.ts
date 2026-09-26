import { describe, expect, it } from 'vitest'
import { rangeRecap, type ReportData } from './reports'
import type { Member, Session, Status } from './types'

const hadir: Status = {
  id: 'h',
  category_id: 'c',
  label: 'Hadir',
  color: '#16a34a',
  sort_order: 1,
  counts_as_present: true,
  archived_at: null,
}
const izin: Status = { ...hadir, id: 'i', label: 'Izin', sort_order: 2, counts_as_present: false }

const members: Member[] = Array.from({ length: 10 }, (_, i) => ({
  id: `m${i}`,
  name: `Anggota ${i}`,
  gender: i < 5 ? 'L' : 'P',
}))

function session(id: string, sessionDate: string, closed = true): Session {
  const at = `${sessionDate}T01:00:00Z`
  return {
    id,
    category_id: 'c',
    label: id,
    session_date: sessionDate,
    note: null,
    start_time: '08:00:00',
    end_time: '09:00:00',
    grace_hours: 0,
    opens_at: at,
    closes_at: at,
    started_at: at,
    closed_at: closed ? at : null,
  }
}

// 4 sesi bertanggal September (s4 bertanggal 30 Sep walau baru ditutup Oktober), 1 sesi Oktober.
// Hadir per sesi: 9, 8, 7, 6 = 30; s1 juga punya 1 Izin.
const sessions = [
  session('okt', '2026-10-05', false),
  session('s4', '2026-09-30'),
  session('s3', '2026-09-21'),
  session('s2', '2026-09-14'),
  session('s1', '2026-09-07'),
]
const hadirCount: Record<string, number> = { s1: 9, s2: 8, s3: 7, s4: 6, okt: 10 }
const data: ReportData = {
  category: {
    id: 'c',
    name: 'Kelas A',
    slug: 'kelas-a',
    pin_enabled: false,
    is_active: true,
    created_at: '',
    owner_unit_id: 'u',
    scope_all: true,
    criteria_gender: null,
    criteria_min_age: null,
    criteria_max_age: null,
    criteria_marital: null,
  },
  kelompokBySession: new Map(),
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

// Waktu acuan setelah semua sesi di atas dibuka.
const AFTER = new Date('2026-12-01T00:00:00Z')

describe('rangeRecap', () => {
  it('rentang September: 10 anggota × 4 sesi, 30 hadir = 75%', () => {
    const r = rangeRecap(data, { from: '2026-09-01', to: '2026-09-30' }, AFTER)
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
    expect(r.single).toBeNull()
  })

  it('satu tanggal dengan satu sesi menyertakan daftar status per anggota', () => {
    const r = rangeRecap(data, { from: '2026-09-07', to: '2026-09-07' }, AFTER)
    expect(r.sessions.map((s) => s.id)).toEqual(['s1'])
    expect(r.single?.members.find((m) => m.member.id === 'm9')?.status?.label).toBe('Izin')
    expect(r.stats.all.percent).toBe(90)
  })

  it('sesi yang belum dibuka (dijadwalkan) tidak dihitung', () => {
    // Pada 1 Oktober 2026 pagi, sesi 5 Oktober masih dijadwalkan.
    const r = rangeRecap(data, { from: '2026-10-01', to: '2026-10-31' }, new Date('2026-10-01T00:00:00Z'))
    expect(r.sessions).toEqual([])
    const later = rangeRecap(data, { from: '2026-10-01', to: '2026-10-31' }, new Date('2026-10-06T00:00:00Z'))
    expect(later.sessions.map((s) => s.id)).toEqual(['okt'])
  })

  it('tanpa sesi: rekap kosong', () => {
    const r = rangeRecap(data, { from: '2026-09-08', to: '2026-09-08' }, AFTER)
    expect(r.sessions).toEqual([])
    expect(r.stats.all).toEqual({ present: 0, total: 0, percent: 0 })
    expect(r.single).toBeNull()
  })
})
