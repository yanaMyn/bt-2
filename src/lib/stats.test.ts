import { describe, expect, it } from 'vitest'
import { computeStats, type Gender } from './stats'

function members(l: number, p: number) {
  return [
    ...Array.from({ length: l }, (_, i) => ({ id: `L${i}`, gender: 'L' as Gender })),
    ...Array.from({ length: p }, (_, i) => ({ id: `P${i}`, gender: 'P' as Gender })),
  ]
}

describe('computeStats', () => {
  it('77/82 L hadir menjadi 94%', () => {
    const ms = members(82, 0)
    const status = new Map(ms.slice(0, 77).map((m) => [m.id, 'hadir']))
    const s = computeStats(ms, status, new Set(['hadir']))
    expect(s.L).toEqual({ present: 77, total: 82, percent: 94 })
    expect(s.P).toEqual({ present: 0, total: 0, percent: 0 })
  })

  it('anggota belum diisi tetap masuk penyebut (6 hadir, 1 izin, 3 belum = 60%)', () => {
    const ms = members(5, 5)
    const status = new Map<string, string>([
      ...ms.slice(0, 6).map((m) => [m.id, 'hadir'] as [string, string]),
      [ms[6].id, 'izin'],
    ])
    const s = computeStats(ms, status, new Set(['hadir']))
    expect(s.all).toEqual({ present: 6, total: 10, percent: 60 })
    expect(s.L).toEqual({ present: 5, total: 5, percent: 100 })
    expect(s.P).toEqual({ present: 1, total: 5, percent: 20 })
  })

  it('beberapa status dihitung hadir', () => {
    const ms = members(2, 0)
    const status = new Map([
      ['L0', 'hadir'],
      ['L1', 'mandiri'],
    ])
    expect(computeStats(ms, status, new Set(['hadir', 'mandiri'])).all.percent).toBe(100)
  })

  it('penyebut nol menghasilkan 0%', () => {
    expect(computeStats([], new Map(), new Set()).all).toEqual({ present: 0, total: 0, percent: 0 })
  })
})
