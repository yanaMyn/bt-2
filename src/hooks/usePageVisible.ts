import { useEffect, useState } from 'react'
import { createVisibilityController } from '../lib/visibility'

/**
 * `false` setelah halaman tersembunyi (tab latar belakang, layar mati) lebih dari `graceMs`;
 * langsung `true` lagi saat terlihat. Jeda mencegah sambung-putus saat berpindah aplikasi sebentar.
 */
export function usePageVisible(graceMs = 60_000): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const c = createVisibilityController(graceMs, setVisible)
    const sync = () => (document.visibilityState === 'hidden' ? c.hidden() : c.shown())
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      c.dispose()
    }
  }, [graceMs])
  return visible
}
