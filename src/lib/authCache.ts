import type { QueryClient } from '@tanstack/react-query'

type AuthLike = {
  onAuthStateChange: (cb: (event: string, session: { user: { id: string } } | null) => void) => {
    data: { subscription: { unsubscribe: () => void } }
  }
}

/** Buang semua data panel admin (profil, unit, jamaah, laporan, …) dari cache. */
export function clearAdminCache(qc: QueryClient): void {
  qc.removeQueries({ queryKey: ['admin'] })
}

/**
 * Data admin di-cache per tab browser. Setiap kali akun yang login berganti (keluar, masuk dengan akun lain,
 * sesi habis, atau berganti di tab lain), cache admin dibuang agar tidak tampil data akun sebelumnya.
 * Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function clearAdminCacheOnUserChange(auth: AuthLike, qc: QueryClient): () => void {
  let current: string | null | undefined // undefined = belum tahu (sebelum event pertama)
  const { data } = auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null
    if (current !== undefined && next !== current) clearAdminCache(qc)
    current = next
  })
  return () => data.subscription.unsubscribe()
}
