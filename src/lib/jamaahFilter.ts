import type { Jamaah, OrgUnit } from './types'

export type JamaahStatusFilter = 'aktif' | 'nonaktif' | 'menunggu' | 'semua'

export interface JamaahFilter {
  search: string
  /** '' = semua; id desa (hanya untuk admin Daerah) */
  desa: string
  /** '' = semua; id kelompok */
  kelompok: string
  status: JamaahStatusFilter
  /** Hanya jamaah tanpa tanggal lahir */
  incomplete: boolean
}

export const DEFAULT_FILTER: JamaahFilter = { search: '', desa: '', kelompok: '', status: 'aktif', incomplete: false }

const norm = (s: string) => s.trim().toLocaleLowerCase('id')

export function filterJamaah(
  list: readonly Jamaah[],
  f: JamaahFilter,
  units: readonly OrgUnit[],
  pendingIds: ReadonlySet<string>,
): Jamaah[] {
  const q = norm(f.search)
  const parentOf = new Map(units.map((u) => [u.id, u.parent_id]))
  return list.filter((m) => {
    if (q && !norm(m.name).includes(q)) return false
    if (f.kelompok && m.kelompok_id !== f.kelompok) return false
    if (f.desa && parentOf.get(m.kelompok_id) !== f.desa) return false
    if (f.incomplete && m.birth_date) return false
    switch (f.status) {
      case 'aktif':
        return !m.inactive_since
      case 'nonaktif':
        return Boolean(m.inactive_since)
      case 'menunggu':
        return pendingIds.has(m.id)
      default:
        return true
    }
  })
}
