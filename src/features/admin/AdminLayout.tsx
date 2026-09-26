import { NavLink, Outlet, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'

const NAV = [
  { to: '/admin/kategori', label: 'Kategori' },
  { to: '/admin/anggota', label: 'Anggota' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/laporan', label: 'Laporan' },
]

export function AdminLayout() {
  const navigate = useNavigate()
  async function logout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <span className="text-lg font-bold">Admin Absensi</span>
          <button type="button" onClick={logout} className="min-h-11 rounded-lg px-3 text-gray-200 hover:bg-white/10">
            Keluar
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-1 px-2 pb-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
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
