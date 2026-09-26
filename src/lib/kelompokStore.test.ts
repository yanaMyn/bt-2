import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearKelompok, getKelompok, saveKelompok } from './kelompokStore'

afterEach(() => {
  clearKelompok()
  vi.unstubAllGlobals()
})

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

function throwingStorage(): Storage {
  const boom = () => {
    throw new Error('SecurityError')
  }
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }
}

const bi = { id: 'k1', slug: 'baitul-ilmi', name: 'Baitul Ilmi' }

describe('kelompokStore', () => {
  it('menyimpan, membaca, dan menghapus kelompok', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    expect(getKelompok()).toBeNull()
    saveKelompok(bi)
    expect(JSON.parse(storage.getItem('kelompok')!)).toEqual(bi)
    expect(getKelompok()).toEqual(bi)
    clearKelompok()
    expect(getKelompok()).toBeNull()
  })

  it('memakai memori bila localStorage diblokir', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    saveKelompok(bi)
    expect(getKelompok()).toEqual(bi)
  })

  it('mengabaikan isi rusak', () => {
    const storage = fakeStorage()
    storage.setItem('kelompok', '{"id":1')
    vi.stubGlobal('localStorage', storage)
    expect(getKelompok()).toBeNull()
    storage.setItem('kelompok', '{"id":"x"}')
    expect(getKelompok()).toBeNull()
  })
})
