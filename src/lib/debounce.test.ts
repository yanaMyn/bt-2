import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from './debounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createDebouncer', () => {
  it('rentetan 40 pemicu dalam 2 detik menjadi satu panggilan', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, { wait: 3000, maxWait: 10_000 })
    for (let i = 0; i < 40; i++) {
      d.trigger()
      vi.advanceTimersByTime(50)
    }
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('maxWait memaksa panggilan saat pemicu terus berdatangan', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, { wait: 3000, maxWait: 10_000 })
    for (let t = 0; t < 25_000; t += 1000) {
      d.trigger()
      vi.advanceTimersByTime(1000)
    }
    // Panggilan di sekitar 10 dtk dan 20 dtk walau pemicu tidak pernah berhenti.
    expect(fn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('cancel mencegah panggilan; flush memanggil seketika hanya bila ada yang tertunda', () => {
    const fn = vi.fn()
    const d = createDebouncer(fn, { wait: 3000 })
    d.trigger()
    d.cancel()
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()

    d.flush()
    expect(fn).not.toHaveBeenCalled()
    d.trigger()
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
