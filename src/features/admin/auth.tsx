import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'

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

export function RequireAdmin() {
  const session = useAuthSession()
  const location = useLocation()
  if (session === undefined) return <p className="py-16 text-center text-muted">Memeriksa sesi…</p>
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
