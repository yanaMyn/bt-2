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
  /** Label sesi (per sesi) atau jumlah sesi (per bulan). */
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

/** offset 0 = sesi aktif, 1 = satu sesi sebelumnya, dst. (dihitung mundur per kategori). */
export function compareBySession(
  categories: readonly CompareCategory[],
  stats: readonly SessionStatRow[],
  offset: number,
): CompareItem[] {
  const grouped = byCategory(stats)
  return sortItems(
    categories.map((category) => {
      const sessions = (grouped.get(category.id) ?? []).sort(
        (a, b) =>
          Number(a.closed_at !== null) - Number(b.closed_at !== null) || b.started_at.localeCompare(a.started_at),
      )
      const s = sessions[offset]
      if (!s) return { category, percent: null, present: 0, total: 0, detail: null }
      return {
        category,
        percent: stat(s.present, s.total).percent,
        present: s.present,
        total: s.total,
        detail: s.label,
      }
    }),
  )
}

export function compareByMonth(
  categories: readonly CompareCategory[],
  stats: readonly SessionStatRow[],
  month: string,
): CompareItem[] {
  const grouped = byCategory(stats)
  return sortItems(
    categories.map((category) => {
      const sessions = (grouped.get(category.id) ?? []).filter((s) => s.month === month)
      if (sessions.length === 0) return { category, percent: null, present: 0, total: 0, detail: null }
      const present = sessions.reduce((n, s) => n + s.present, 0)
      const total = sessions.reduce((n, s) => n + s.total, 0)
      return { category, percent: stat(present, total).percent, present, total, detail: `${sessions.length} sesi` }
    }),
  )
}

/** Jumlah maksimum sesi yang dimiliki satu kategori (untuk pilihan "N sesi sebelumnya"). */
export function maxSessionCount(stats: readonly SessionStatRow[]): number {
  return Math.max(0, ...[...byCategory(stats).values()].map((l) => l.length))
}
