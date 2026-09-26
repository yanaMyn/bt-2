import { useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { LEVEL_LABEL, useProfile, type UnitLevel } from './profile'

const NAV: { to: string; label: string; end?: boolean; levels?: UnitLevel[] }[] = [
  { to: '/admin', label: 'Beranda', end: true },
  { to: '/admin/kegiatan', label: 'Kegiatan' },
  { to: '/admin/jamaah', label: 'Jamaah' },
  { to: '/admin/laporan', label: 'Laporan' },
  { to: '/admin/struktur', label: 'Struktur', levels: ['daerah', 'desa'] },
  { to: '/admin/akun', label: 'Admin', levels: ['daerah', 'desa'] },
  { to: '/admin/templat', label: 'Templat', levels: ['daerah'] },
]

export function AdminLayout() {
  const profile = useProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  async function logout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
    clearAdminCache(qc)
  }
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <span className="min-w-0">
            <span className="block text-lg leading-tight font-bold">Admin Absensi</span>
            <span className="block truncate text-sm text-gray-300">
              {LEVEL_LABEL[profile.unit_level]} {profile.unit_name} · @{profile.username}
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <NavLink
              to="/admin/ganti-password"
              className="flex min-h-11 items-center rounded-lg px-3 text-gray-200 hover:bg-white/10"
            >
              Password
            </NavLink>
            <button type="button" onClick={logout} className="min-h-11 rounded-lg px-3 text-gray-200 hover:bg-white/10">
              Keluar
            </button>
          </span>
        </div>
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-1 px-2 pb-2">
          {NAV.filter((n) => !n.levels || n.levels.includes(profile.unit_level)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `min-h-11 rounded-lg px-3 py-2.5 font-medium ${isActive ? 'bg-white text-gray-900' : 'text-gray-200 hover:bg-white/10'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
