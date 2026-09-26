import { inRange, type DateRange } from './dateRange'
import { stat } from './stats'

/** Baris view session_stats. */
export interface SessionStatRow {
  session_id: string
  category_id: string
  label: string
  session_date: string
  note: string | null
  started_at: string
  closed_at: string | null
  month: string
  total: number
  present: number
}

export interface CompareCategory {
  id: string
  name: string
  is_active: boolean
}

export interface CompareItem {
  category: CompareCategory
  /** null = tidak ada sesi untuk pilihan ini */
  percent: number | null
  present: number
  total: number
  /** Jumlah sesi yang digabung, mis. "3 sesi". */
  detail: string | null
}

function sortItems(items: CompareItem[]): CompareItem[] {
  return items.sort((a, b) => {
    if (a.percent === null || b.percent === null) {
      if (a.percent === b.percent) return a.category.name.localeCompare(b.category.name, 'id')
      return a.percent === null ? 1 : -1
    }
    return b.percent - a.percent || a.category.name.localeCompare(b.category.name, 'id')
  })
}

function byCategory(stats: readonly SessionStatRow[]): Map<string, SessionStatRow[]> {
  const map = new Map<string, SessionStatRow[]>()
  for (const s of stats) {
    const list = map.get(s.category_id) ?? []
    list.push(s)
    map.set(s.category_id, list)
  }
  return map
}

/** % hadir tiap kategori dari gabungan sesinya yang bertanggal di dalam rentang. */
export function compareByRange(
  categories: readonly CompareCategory[],
  stats: readonly SessionStatRow[],
  range: DateRange,
): CompareItem[] {
  const grouped = byCategory(stats)
  return sortItems(
    categories.map((category) => {
      const sessions = (grouped.get(category.id) ?? []).filter((s) => inRange(s.session_date, range))
      if (sessions.length === 0) return { category, percent: null, present: 0, total: 0, detail: null }
      const present = sessions.reduce((n, s) => n + s.present, 0)
      const total = sessions.reduce((n, s) => n + s.total, 0)
      return { category, percent: stat(present, total).percent, present, total, detail: `${sessions.length} sesi` }
    }),
  )
}
