import { useCallback, useEffect, useRef, useState } from 'react'
import { usePageVisible } from './usePageVisible'
import type { RealtimeStatus } from './useRealtime'

/** Interval penyegaran cadangan saat pembaruan langsung tidak tersambung. */
export const FALLBACK_POLL_MS = 30_000

/**
 * Kesehatan kanal realtime sebuah halaman publik (design D6, D7):
 * - `enabled`: false setelah halaman tersembunyi > 1 menit, sehingga kanal dilepas;
 * - `resync` dipanggil saat halaman terlihat lagi dan saat kanal pulih setelah gagal;
 * - `refetchInterval`: polling 30 detik selama kanal gagal tersambung (React Query hanya
 *   memolling saat halaman terlihat).
 */
export function useLiveChannel(resync: () => void) {
  const visible = usePageVisible()
  const [live, setLive] = useState(true)
  const failed = useRef(false)
  const latest = useRef(resync)
  latest.current = resync

  const wasVisible = useRef(visible)
  useEffect(() => {
    if (visible && !wasVisible.current) latest.current()
    wasVisible.current = visible
  }, [visible])

  const onStatus = useCallback((status: RealtimeStatus) => {
    if (status === 'SUBSCRIBED') {
      setLive(true)
      if (failed.current) {
        failed.current = false
        latest.current()
      }
    } else {
      failed.current = true
      setLive(false)
    }
  }, [])

  return { enabled: visible, onStatus, refetchInterval: live ? (false as const) : FALLBACK_POLL_MS }
}
