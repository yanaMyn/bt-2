import type { ActivityCriteria, Marital, OrgUnit } from './types'

/** Umur dalam tahun penuh pada tanggal `on` (YYYY-MM-DD); null bila tanggal lahir kosong. */
export function ageOn(birthDate: string | null, on: string): number | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age -= 1
  return age
}

export const MARITAL_LABEL: Record<Marital, string> = {
  belum: 'Belum menikah',
  menikah: 'Menikah',
  janda_duda: 'Janda/Duda',
}

/** "L · 16–19 th · belum menikah" ; "Semua jamaah" bila tanpa kriteria. */
export function criteriaText(c: ActivityCriteria): string {
  const parts: string[] = []
  if (c.criteria_gender) parts.push(c.criteria_gender === 'L' ? 'Laki-laki' : 'Perempuan')
  const min = c.criteria_min_age
  const max = c.criteria_max_age
  if (min !== null && max !== null) parts.push(`${min}–${max} th`)
  else if (min !== null) parts.push(`${min}+ th`)
  else if (max !== null) parts.push(`≤ ${max} th`)
  if (c.criteria_marital) parts.push(c.criteria_marital === 'belum' ? 'belum menikah' : 'pernah menikah')
  return parts.length ? parts.join(' · ') : 'Semua jamaah'
}

export const hasAgeLimit = (c: ActivityCriteria) => c.criteria_min_age !== null || c.criteria_max_age !== null

/** Anak langsung sebuah unit, urut nama. */
export function childrenOf(units: readonly OrgUnit[], parentId: string | null): OrgUnit[] {
  return units
    .filter((u) => u.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

/** "Baitul Ilmi (CNT)" untuk kelompok, nama saja untuk unit lain. */
export function unitLabel(units: readonly OrgUnit[], id: string | null | undefined): string {
  const u = units.find((x) => x.id === id)
  if (!u) return '–'
  if (u.level !== 'kelompok') return u.name
  const parent = units.find((x) => x.id === u.parent_id)
  return parent ? `${u.name} (${parent.name})` : u.name
}
