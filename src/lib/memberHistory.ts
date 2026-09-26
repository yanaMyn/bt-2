import { percent } from './stats'
import type { UnitLevel } from './types'

/** Baris RPC member_history: satu sesi yang diikuti seorang jamaah. */
export interface HistoryRow {
  session_id: string
  session_date: string
  session_label: string
  start_time: string | null
  category_id: string
  category_name: string
  owner_level: UnitLevel
  owner_name: string
  kelompok_id: string
  kelompok_name: string
  status_id: string | null
  status_label: string | null
  status_color: string | null
  counts_as_present: boolean
}

export interface HistoryByActivity {
  category_id: string
  category_name: string
  owner_level: UnitLevel
  owner_name: string
  sessions: number
  present: number
  percent: number
}

const LEVEL_ORDER: Record<UnitLevel, number> = { kelompok: 0, desa: 1, daerah: 2 }

/** Persentase hadir per kegiatan (urut level Kelompok → Desa → Daerah, lalu nama) dan totalnya. */
export function historySummary(rows: readonly HistoryRow[]): {
  activities: HistoryByActivity[]
  sessions: number
  present: number
  percent: number
} {
  const acc = new Map<string, HistoryByActivity>()
  for (const r of rows) {
    let a = acc.get(r.category_id)
    if (!a) {
      a = {
        category_id: r.category_id,
        category_name: r.category_name,
        owner_level: r.owner_level,
        owner_name: r.owner_name,
        sessions: 0,
        present: 0,
        percent: 0,
      }
      acc.set(r.category_id, a)
    }
    a.sessions += 1
    if (r.counts_as_present) a.present += 1
  }
  const activities = [...acc.values()]
    .map((a) => ({ ...a, percent: percent(a.present, a.sessions) }))
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.owner_level] - LEVEL_ORDER[b.owner_level] ||
        a.category_name.localeCompare(b.category_name, 'id', { sensitivity: 'base' }),
    )
  const present = rows.filter((r) => r.counts_as_present).length
  return { activities, sessions: rows.length, present, percent: percent(present, rows.length) }
}
