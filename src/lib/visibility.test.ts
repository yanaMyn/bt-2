import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVisibilityController } from './visibility'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createVisibilityController', () => {
  it('tersembunyi < 60 detik tetap terlihat; > 60 detik tidak; terlihat lagi langsung true', () => {
    const changes: boolean[] = []
    const c = createVisibilityController(60_000, (v) => changes.push(v))

    c.hidden()
    vi.advanceTimersByTime(59_000)
    c.shown()
    expect(c.visible).toBe(true)
    expect(changes).toEqual([])

    c.hidden()
    vi.advanceTimersByTime(60_000)
    expect(c.visible).toBe(false)
    c.shown()
    expect(c.visible).toBe(true)
    expect(changes).toEqual([false, true])
  })
})
