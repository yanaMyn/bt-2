import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTER, filterJamaah } from './jamaahFilter'
import type { Jamaah, OrgUnit } from './types'

const units: OrgUnit[] = [
  { id: 'cnt', level: 'desa', parent_id: 'd', name: 'CNT', slug: 'cnt' },
  { id: 'cnb', level: 'desa', parent_id: 'd', name: 'CNB', slug: 'cnb' },
  { id: 'bi', level: 'kelompok', parent_id: 'cnt', name: 'Baitul Ilmi', slug: 'bi' },
  { id: 'cib', level: 'kelompok', parent_id: 'cnb', name: 'Cibubur', slug: 'cib' },
]
const j = (id: string, name: string, kelompok: string, extra: Partial<Jamaah> = {}): Jamaah => ({
  id,
  name,
  gender: 'L',
  kelompok_id: kelompok,
  birth_date: '2000-01-01',
  marital_status: 'belum',
  inactive_since: null,
  inactive_reason: null,
  created_at: '',
  ...extra,
})
const list = [
  j('1', 'Fajar', 'bi'),
  j('2', 'Fatimah', 'bi', { birth_date: null }),
  j('3', 'Budi', 'cib'),
  j('4', 'Farhan', 'bi', { inactive_since: '2026-01-01', inactive_reason: 'meninggal' }),
]
const names = (xs: Jamaah[]) => xs.map((x) => x.name)

describe('filterJamaah', () => {
  it('default: aktif saja', () => {
    expect(names(filterJamaah(list, DEFAULT_FILTER, units, new Set()))).toEqual(['Fajar', 'Fatimah', 'Budi'])
  })
  it('desa, kelompok, pencarian, data belum lengkap', () => {
    expect(names(filterJamaah(list, { ...DEFAULT_FILTER, desa: 'cnb' }, units, new Set()))).toEqual(['Budi'])
    expect(names(filterJamaah(list, { ...DEFAULT_FILTER, kelompok: 'bi', search: 'fa' }, units, new Set()))).toEqual([
      'Fajar',
      'Fatimah',
    ])
    expect(names(filterJamaah(list, { ...DEFAULT_FILTER, incomplete: true }, units, new Set()))).toEqual(['Fatimah'])
  })
  it('status nonaktif, menunggu pindah, semua', () => {
    expect(names(filterJamaah(list, { ...DEFAULT_FILTER, status: 'nonaktif' }, units, new Set()))).toEqual(['Farhan'])
    expect(names(filterJamaah(list, { ...DEFAULT_FILTER, status: 'menunggu' }, units, new Set(['3'])))).toEqual(['Budi'])
    expect(filterJamaah(list, { ...DEFAULT_FILTER, status: 'semua' }, units, new Set())).toHaveLength(4)
  })
})
