import { describe, expect, it } from 'vitest'
import { ageOn, childrenOf, criteriaText, unitLabel } from './criteria'
import type { OrgUnit } from './types'

const none = { criteria_gender: null, criteria_min_age: null, criteria_max_age: null, criteria_marital: null }

describe('ageOn', () => {
  it('umur penuh pada tanggal tertentu (sama dengan server)', () => {
    expect(ageOn('2010-10-05', '2026-10-05')).toBe(16)
    expect(ageOn('2010-10-06', '2026-10-05')).toBe(15)
    expect(ageOn('2006-10-04', '2026-10-05')).toBe(20)
    expect(ageOn(null, '2026-10-05')).toBeNull()
  })
})

describe('criteriaText', () => {
  it('meringkas kriteria', () => {
    expect(criteriaText(none)).toBe('Semua jamaah')
    expect(criteriaText({ ...none, criteria_min_age: 16, criteria_max_age: 19 })).toBe('16–19 th')
    expect(criteriaText({ ...none, criteria_min_age: 20, criteria_marital: 'belum' })).toBe('20+ th · belum menikah')
    expect(criteriaText({ ...none, criteria_gender: 'P', criteria_marital: 'pernah' })).toBe('Perempuan · pernah menikah')
  })
})

describe('unit helpers', () => {
  const units: OrgUnit[] = [
    { id: 'd', level: 'daerah', parent_id: null, name: 'Daerah', slug: 'daerah' },
    { id: 'cnt', level: 'desa', parent_id: 'd', name: 'CNT', slug: 'cnt' },
    { id: 'c', level: 'kelompok', parent_id: 'cnt', name: 'Citra', slug: 'citra' },
    { id: 'b', level: 'kelompok', parent_id: 'cnt', name: 'Baitul Ilmi', slug: 'baitul-ilmi' },
  ]
  it('anak urut nama & label kelompok dengan desanya', () => {
    expect(childrenOf(units, 'cnt').map((u) => u.name)).toEqual(['Baitul Ilmi', 'Citra'])
    expect(unitLabel(units, 'b')).toBe('Baitul Ilmi (CNT)')
    expect(unitLabel(units, 'cnt')).toBe('CNT')
    expect(unitLabel(units, 'x')).toBe('–')
  })
})
