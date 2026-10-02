import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/ui'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { AuthShell } from './AuthShell'
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
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="flex items-center gap-3 font-semibold text-muted">
          <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden />
          Memeriksa sesi…
        </span>
      </div>
    )
  }
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (profile.isError || !profile.data) {
    return (
      <AuthShell title="Tidak ada akses" description="Akun ini tidak memiliki akses admin">
        <p className="mb-4 text-center text-muted">Akun mungkin dinonaktifkan. Hubungi admin di atas Anda.</p>
        <Button
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/admin/login', { replace: true })
            clearAdminCache(qc)
          }}
        >
          Keluar
        </Button>
      </AuthShell>
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
