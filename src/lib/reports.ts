import { monthKey } from './sessionLabel'
import { computeStats, percent, stat, type Stats } from './stats'
import type { Category, Member, Session, Status } from './types'

export interface ReportData {
  category: Category
  statuses: Status[]
  /** Terbaru dulu. */
  sessions: Session[]
  members: Map<string, Member>
  /** Anggota tiap sesi: snapshot untuk sesi tertutup, keanggotaan saat ini untuk sesi aktif (D3). */
  membersBySession: Map<string, string[]>
  /** session_id -> (member_id -> status_id) */
  attendanceBySession: Map<string, Map<string, string>>
}

const byName = (a: Member, b: Member) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })

function presentIds(statuses: Status[]): Set<string> {
  return new Set(statuses.filter((s) => s.counts_as_present).map((s) => s.id))
}

/** Status aktif + status terarsip yang terpakai, sesuai urutan. */
function visibleStatuses(statuses: Status[], used: Set<string>): Status[] {
  return statuses.filter((s) => !s.archived_at || used.has(s.id))
}

function sessionMembers(data: ReportData, sessionId: string): Member[] {
  return (data.membersBySession.get(sessionId) ?? [])
    .map((id) => data.members.get(id))
    .filter((m): m is Member => Boolean(m))
}

export interface RecapRow {
  label: string
  color: string | null
  L: number
  P: number
  total: number
}

export interface SessionRecap {
  session: Session
  rows: RecapRow[]
  stats: Stats
  members: { member: Member; status: Status | null }[]
}

export function sessionRecap(data: ReportData, sessionId: string): SessionRecap {
  const session = data.sessions.find((s) => s.id === sessionId)!
  const members = sessionMembers(data, sessionId).sort(byName)
  const att = data.attendanceBySession.get(sessionId) ?? new Map<string, string>()
  const statusById = new Map(data.statuses.map((s) => [s.id, s]))

  const used = new Set<string>()
  for (const m of members) {
    const s = att.get(m.id)
    if (s) used.add(s)
  }
  const shown = visibleStatuses(data.statuses, used)
  const rows = new Map<string, RecapRow>(
    shown.map((s) => [s.id, { label: s.label, color: s.color, L: 0, P: 0, total: 0 }]),
  )
  const belum: RecapRow = { label: 'Belum', color: null, L: 0, P: 0, total: 0 }
  for (const m of members) {
    const statusId = att.get(m.id)
    const row = (statusId && rows.get(statusId)) || belum
    row[m.gender] += 1
    row.total += 1
  }

  return {
    session,
    rows: [...rows.values(), belum],
    stats: computeStats(members, att, presentIds(data.statuses)),
    members: members.map((m) => ({ member: m, status: statusById.get(att.get(m.id) ?? '') ?? null })),
  }
}

export interface MemberRecapRow {
  member: Member
  /** status_id -> jumlah sesi */
  counts: Map<string, number>
  belum: number
  sessions: number
  present: number
  percent: number
}

export interface MemberRecap {
  statuses: Status[]
  rows: MemberRecapRow[]
}

/** Rekap per anggota untuk sesi-sesi yang dipilih; hanya sesi saat ia menjadi anggota yang dihitung. */
export function memberRecap(data: ReportData, sessionIds: readonly string[]): MemberRecap {
  const present = presentIds(data.statuses)
  const acc = new Map<string, MemberRecapRow>()
  const used = new Set<string>()

  for (const sid of sessionIds) {
    const att = data.attendanceBySession.get(sid) ?? new Map<string, string>()
    for (const member of sessionMembers(data, sid)) {
      let row = acc.get(member.id)
      if (!row) {
        row = { member, counts: new Map(), belum: 0, sessions: 0, present: 0, percent: 0 }
        acc.set(member.id, row)
      }
      row.sessions += 1
      const statusId = att.get(member.id)
      if (statusId) {
        used.add(statusId)
        row.counts.set(statusId, (row.counts.get(statusId) ?? 0) + 1)
        if (present.has(statusId)) row.present += 1
      } else {
        row.belum += 1
      }
    }
  }

  const rows = [...acc.values()]
    .map((r) => ({ ...r, percent: percent(r.present, r.sessions) }))
    .sort((a, b) => byName(a.member, b.member))
  return { statuses: visibleStatuses(data.statuses, used), rows }
}

/** Bulan (YYYY-MM, dari tanggal sesi) yang memiliki sesi, terbaru dulu. */
export function availableMonths(sessions: readonly Session[]): string[] {
  return [...new Set(sessions.map((s) => monthKey(s.session_date)))].sort().reverse()
}

export interface MonthRecap {
  month: string
  /** Sesi bertanggal di bulan itu, urut tanggal. */
  sessions: Session[]
  /** Jumlah isian anggota-sesi per status × jenis kelamin. */
  rows: RecapRow[]
  /** Persentase dari isian anggota-sesi (hadir ÷ seluruh anggota-sesi). */
  stats: Stats
  members: MemberRecap
}

export function monthRecap(data: ReportData, month: string): MonthRecap {
  const sessions = data.sessions
    .filter((s) => monthKey(s.session_date) === month)
    .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.started_at.localeCompare(b.started_at))
  const present = presentIds(data.statuses)
  const used = new Set<string>()
  const counts = new Map<string, RecapRow>()
  const belum: RecapRow = { label: 'Belum', color: null, L: 0, P: 0, total: 0 }
  const tally = { all: [0, 0], L: [0, 0], P: [0, 0] }

  for (const s of sessions) {
    const att = data.attendanceBySession.get(s.id) ?? new Map<string, string>()
    for (const m of sessionMembers(data, s.id)) {
      const statusId = att.get(m.id)
      let row = belum
      if (statusId) {
        used.add(statusId)
        row = counts.get(statusId) ?? { label: '', color: null, L: 0, P: 0, total: 0 }
        counts.set(statusId, row)
      }
      row[m.gender] += 1
      row.total += 1
      const hit = statusId && present.has(statusId) ? 1 : 0
      tally.all[0] += hit
      tally.all[1] += 1
      tally[m.gender][0] += hit
      tally[m.gender][1] += 1
    }
  }

  const rows = visibleStatuses(data.statuses, used).map((st) => ({
    label: st.label,
    color: st.color,
    L: counts.get(st.id)?.L ?? 0,
    P: counts.get(st.id)?.P ?? 0,
    total: counts.get(st.id)?.total ?? 0,
  }))

  return {
    month,
    sessions,
    rows: [...rows, belum],
    stats: {
      all: stat(tally.all[0], tally.all[1]),
      L: stat(tally.L[0], tally.L[1]),
      P: stat(tally.P[0], tally.P[1]),
    },
    members: memberRecap(
      data,
      sessions.map((s) => s.id),
    ),
  }
}
