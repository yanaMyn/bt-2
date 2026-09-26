import { describe, expect, it } from 'vitest'
import { memberRecap, sessionRecap, type ReportData } from './reports'
import type { Member, Session, Status } from './types'

const status = (id: string, label: string, present = false, archived = false): Status => ({
  id,
  category_id: 'c',
  label,
  color: '#000000',
  sort_order: 0,
  counts_as_present: present,
  archived_at: archived ? '2026-01-01' : null,
})

const session = (id: string, closed: boolean): Session => ({
  id,
  category_id: 'c',
  label: id,
  session_date: '2026-01-01',
  note: null,
  started_at: '2026-01-01',
  closed_at: closed ? '2026-01-02' : null,
})

function build(opts: {
  sessions: Session[]
  members: Member[]
  membersBySession: Record<string, string[]>
  attendance: Record<string, Record<string, string>>
  statuses?: Status[]
}): ReportData {
  return {
    category: { id: 'c', name: 'Kelas A', slug: 'kelas-a', pin_enabled: false, is_active: true, created_at: '' },
    statuses: opts.statuses ?? [status('h', 'Hadir', true), status('i', 'Izin'), status('d', 'Doa', false, true)],
    sessions: opts.sessions,
    members: new Map(opts.members.map((m) => [m.id, m])),
    membersBySession: new Map(Object.entries(opts.membersBySession)),
    attendanceBySession: new Map(Object.entries(opts.attendance).map(([k, v]) => [k, new Map(Object.entries(v))])),
  }
}

const ahmad: Member = { id: 'a', name: 'Ahmad', gender: 'L' }
const budi: Member = { id: 'b', name: 'Budi', gender: 'L' }
const citra: Member = { id: 'c', name: 'Citra', gender: 'P' }

describe('sessionRecap', () => {
  it('menghitung per status × L/P, baris Belum, dan status terarsip yang terpakai', () => {
    const data = build({
      sessions: [session('s1', true)],
      members: [ahmad, budi, citra],
      membersBySession: { s1: ['a', 'b', 'c'] },
      attendance: { s1: { a: 'h', c: 'd' } },
    })
    const r = sessionRecap(data, 's1')
    expect(r.rows.map((x) => [x.label, x.L, x.P, x.total])).toEqual([
      ['Hadir', 1, 0, 1],
      ['Izin', 0, 0, 0],
      ['Doa', 0, 1, 1],
      ['Belum', 1, 0, 1],
    ])
    expect(r.stats.all).toEqual({ present: 1, total: 3, percent: 33 })
    expect(r.members.map((m) => [m.member.name, m.status?.label ?? null])).toEqual([
      ['Ahmad', 'Hadir'],
      ['Budi', null],
      ['Citra', 'Doa'],
    ])
  })

  it('status terarsip yang tidak terpakai tidak ditampilkan; anggota snapshot yang sudah keluar tetap ada', () => {
    const data = build({
      sessions: [session('s2', false), session('s1', true)],
      members: [ahmad, budi],
      membersBySession: { s1: ['a', 'b'], s2: ['a'] },
      attendance: { s1: { b: 'h' }, s2: {} },
    })
    const r = sessionRecap(data, 's1')
    expect(r.rows.map((x) => x.label)).toEqual(['Hadir', 'Izin', 'Belum'])
    expect(r.members.map((m) => m.member.name)).toEqual(['Ahmad', 'Budi'])
  })
})

describe('memberRecap', () => {
  it('Hadir 8 + Izin 1 dari 9 sesi = 89%', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `s${i}`)
    const data = build({
      sessions: ids.map((id) => session(id, true)),
      members: [ahmad],
      membersBySession: Object.fromEntries(ids.map((id) => [id, ['a']])),
      attendance: Object.fromEntries(ids.map((id, i) => [id, { a: i === 0 ? 'i' : 'h' }])),
    })
    const r = memberRecap(data, ids)
    expect(r.rows[0]).toMatchObject({ sessions: 9, present: 8, belum: 0, percent: 89 })
    expect(r.rows[0].counts.get('h')).toBe(8)
    expect(r.rows[0].counts.get('i')).toBe(1)
    expect(r.statuses.map((s) => s.label)).toEqual(['Hadir', 'Izin'])
  })

  it('hanya menghitung sesi saat orang tersebut menjadi anggota dan menghitung Belum', () => {
    const data = build({
      sessions: [session('s2', false), session('s1', true)],
      members: [ahmad, budi],
      membersBySession: { s1: ['a'], s2: ['a', 'b'] },
      attendance: { s1: { a: 'h' }, s2: {} },
    })
    const r = memberRecap(data, ['s1', 's2'])
    expect(r.rows.map((x) => [x.member.name, x.sessions, x.present, x.belum, x.percent])).toEqual([
      ['Ahmad', 2, 1, 1, 50],
      ['Budi', 1, 0, 1, 0],
    ])
  })
})
