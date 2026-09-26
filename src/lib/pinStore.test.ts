import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPin, getPin, setPin } from './pinStore'

afterEach(() => vi.unstubAllGlobals())

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

describe('pinStore', () => {
  it('menyimpan, membaca, dan menghapus PIN per kategori', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    setPin('a', '1234')
    expect(getPin('a')).toBe('1234')
    expect(getPin('b')).toBeNull()
    expect(storage.getItem('pin:a')).toBe('1234')
    clearPin('a')
    expect(getPin('a')).toBeNull()
  })

  it('tetap bekerja di memori bila localStorage melempar error', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    setPin('c', '5678')
    expect(getPin('c')).toBe('5678')
    clearPin('c')
    expect(getPin('c')).toBeNull()
  })
})
