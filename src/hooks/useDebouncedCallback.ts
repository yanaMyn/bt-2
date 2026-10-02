import { useEffect, useRef, useState } from 'react'
import { createDebouncer, type Debouncer } from '../lib/debounce'

/** Debouncer stabil untuk komponen; panggilan tertunda dibatalkan saat unmount. */
export function useDebouncedCallback(fn: () => void, wait: number, maxWait?: number): Debouncer {
  const latest = useRef(fn)
  latest.current = fn
  const [debouncer] = useState(() => createDebouncer(() => latest.current(), { wait, maxWait }))
  useEffect(() => () => debouncer.cancel(), [debouncer])
  return debouncer
}
