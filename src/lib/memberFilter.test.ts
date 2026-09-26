import { describe, expect, it } from 'vitest'
import { filterMembers, NO_CATEGORY } from './memberFilter'

const people = [
  { name: 'Fajar', category_ids: ['a'] },
  { name: 'Fatimah', category_ids: ['a', 'b'] },
  { name: 'Budi', category_ids: ['b'] },
  { name: 'Farhan', category_ids: [] },
]
const names = (xs: { name: string }[]) => xs.map((x) => x.name)

describe('filterMembers', () => {
  it('semua kategori', () => {
    expect(names(filterMembers(people, '', ''))).toEqual(['Fajar', 'Fatimah', 'Budi', 'Farhan'])
  })
  it('satu kategori, termasuk yang juga di kategori lain', () => {
    expect(names(filterMembers(people, '', 'b'))).toEqual(['Fatimah', 'Budi'])
  })
  it('tanpa kategori', () => {
    expect(names(filterMembers(people, '', NO_CATEGORY))).toEqual(['Farhan'])
  })
  it('digabung dengan pencarian', () => {
    expect(names(filterMembers(people, ' fa ', 'a'))).toEqual(['Fajar', 'Fatimah'])
  })
})
