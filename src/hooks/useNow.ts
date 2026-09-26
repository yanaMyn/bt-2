import { useEffect, useState } from 'react'
import { msUntilNextBoundary } from '../lib/sessionTime'

/**
 * Waktu "sekarang" yang diperbarui tepat setelah batas terdekat (jam buka/tutup sesi)
 * terlewati, sehingga tampilan berganti tanpa dimuat ulang (design D6). `onBoundary`
 * dipanggil setiap kali sebuah batas terlewati, mis. untuk memuat ulang data dari server.
 */
export function useNow(boundaries: readonly (string | null | undefined)[], onBoundary?: () => void): Date {
  const [now, setNow] = useState(() => new Date())
  const key = boundaries.join('|')
  useEffect(() => {
    const ms = msUntilNextBoundary(key.split('|'), new Date())
    if (ms === null) return
    const t = setTimeout(() => {
      setNow(new Date())
      onBoundary?.()
    }, ms)
    return () => clearTimeout(t)
    // onBoundary sengaja tidak menjadi dependensi agar timer tidak dipasang ulang tiap render.
  }, [key, now])
  return now
}
