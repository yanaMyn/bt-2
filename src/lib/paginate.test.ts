import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PAGE_SIZE, loadPageSize, paginate, savePageSize } from './paginate'

const items = Array.from({ length: 120 }, (_, i) => i + 1)

describe('paginate', () => {
  it('memotong halaman dan menghitung posisi', () => {
    const p = paginate(items, 2, 25)
    expect(p.items[0]).toBe(26)
    expect(p).toMatchObject({ page: 2, pageCount: 5, first: 26, last: 50, total: 120 })
    expect(paginate(items, 1, 50)).toMatchObject({ pageCount: 3, first: 1, last: 50 })
    expect(paginate(items, 3, 50)).toMatchObject({ first: 101, last: 120 })
  })

  it('menjepit halaman di luar batas', () => {
    expect(paginate(items, 99, 50).page).toBe(3)
    expect(paginate(items, 0, 50).page).toBe(1)
  })

  it('daftar kosong', () => {
    expect(paginate([], 1, 10)).toMatchObject({ items: [], page: 1, pageCount: 1, first: 0, last: 0, total: 0 })
  })
})

describe('ukuran halaman tersimpan', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('menyimpan dan membaca; nilai tidak valid kembali ke default', () => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    })
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
    savePageSize(50)
    expect(loadPageSize()).toBe(50)
    m.set('admin:page-size', '999')
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
  })

  it('tetap bekerja bila localStorage melempar error', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadPageSize()).toBe(DEFAULT_PAGE_SIZE)
    expect(() => savePageSize(10)).not.toThrow()
  })
})
