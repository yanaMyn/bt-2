import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/ui'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { ProfileProvider, useMyProfileQuery } from './profile'

/** undefined = masih memeriksa, null = belum login. */
export function useAuthSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export const CHANGE_PASSWORD_PATH = '/admin/ganti-password'

/**
 * Hanya admin aktif. Akun yang wajib ganti password hanya boleh membuka halaman ganti password.
 */
export function RequireAdmin() {
  const session = useAuthSession()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const profile = useMyProfileQuery(Boolean(session))

  if (session === undefined || (session && profile.isPending)) {
    return <p className="py-16 text-center text-muted">Memeriksa sesi…</p>
  }
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (profile.isError || !profile.data) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-lg font-bold">Akun ini tidak memiliki akses admin</p>
        <p className="mt-1 text-muted">Akun mungkin dinonaktifkan. Hubungi admin di atas Anda.</p>
        <Button
          className="mt-4"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/admin/login', { replace: true })
            clearAdminCache(qc)
          }}
        >
          Keluar
        </Button>
      </main>
    )
  }
  if (profile.data.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  return (
    <ProfileProvider value={profile.data}>
      <Outlet />
    </ProfileProvider>
  )
}
