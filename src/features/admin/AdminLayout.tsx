import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Ellipsis,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Network,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { Avatar } from '../../components/ui'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { LEVEL_LABEL, useProfile, type UnitLevel } from './profile'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  levels?: UnitLevel[]
}

/** Menu utama: tampil di tab bawah (HP) dan bagian atas sidebar (desktop). */
const PRIMARY: NavItem[] = [
  { to: '/admin', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/admin/kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { to: '/admin/jamaah', label: 'Jamaah', icon: Users },
  { to: '/admin/laporan', label: 'Laporan', icon: ChartColumn },
]

/** Menu kelola: di "Lainnya" (HP) dan bagian bawah sidebar (desktop). */
const SECONDARY: NavItem[] = [
  { to: '/admin/perpindahan', label: 'Perpindahan', icon: ArrowLeftRight, levels: ['kelompok'] },
  { to: '/admin/struktur', label: 'Struktur', icon: Network, levels: ['daerah', 'desa'] },
  { to: '/admin/akun', label: 'Admin', icon: ShieldCheck, levels: ['daerah', 'desa'] },
  { to: '/admin/templat', label: 'Templat', icon: LayoutTemplate, levels: ['daerah'] },
]

const isActive = (pathname: string, item: NavItem) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)

export function AdminLayout() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const [moreOpen, setMoreOpen] = useState(false)
  // Toast diangkat di atas tab bawah (lihat --toast-offset di index.css).
  useEffect(() => {
    document.documentElement.dataset.tabbar = ''
    return () => void delete document.documentElement.dataset.tabbar
  }, [])
  const secondary = SECONDARY.filter((n) => !n.levels || n.levels.includes(profile.unit_level))
  const unitText = `${LEVEL_LABEL[profile.unit_level]} ${profile.unit_name}`

  async function logout() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
    clearAdminCache(qc)
  }

  const sideLink = (n: NavItem) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive: a }) =>
        `flex min-h-11 items-center gap-3 rounded-2xl px-3 font-semibold transition ${
          a ? 'bg-brand-600 text-white shadow-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
        }`
      }
    >
      <n.icon className="size-5 shrink-0" aria-hidden />
      {n.label}
    </NavLink>
  )

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
        <Link to="/admin" className="mb-8 flex items-center gap-3 px-2">
          <span className="hero-bg flex size-10 items-center justify-center rounded-2xl text-white shadow-brand">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-lg leading-tight font-extrabold tracking-tight">Admin Absensi</span>
            <span className="block text-sm text-muted">{unitText}</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Menu utama">
          {PRIMARY.map(sideLink)}
        </nav>
        {secondary.length > 0 && (
          <>
            <p className="mt-8 mb-2 px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">Kelola</p>
            <nav className="flex flex-col gap-1" aria-label="Menu kelola">
              {secondary.map(sideLink)}
            </nav>
          </>
        )}
        <div className="mt-auto rounded-3xl bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile.display_name} />
            <div className="min-w-0">
              <p className="truncate font-bold">{profile.display_name}</p>
              <p className="truncate text-sm text-muted">@{profile.username}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/admin/ganti-password"
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-line hover:bg-slate-100"
            >
              <KeyRound className="size-4" aria-hidden /> Password
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-red-600 ring-1 ring-line hover:bg-red-50"
            >
              <LogOut className="size-4" aria-hidden /> Keluar
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Bar atas HP */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <span className="hero-bg flex size-10 shrink-0 items-center justify-center rounded-2xl text-white">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block leading-tight font-extrabold tracking-tight">Admin Absensi</span>
              <span className="block truncate text-sm text-muted">{unitText}</span>
            </span>
            <button type="button" onClick={() => setMoreOpen(true)} aria-label="Akun dan menu lainnya">
              <Avatar name={profile.display_name} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>

        {/* Tab bawah HP */}
        <nav
          aria-label="Menu utama"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-xl grid-cols-5">
            {PRIMARY.map((n) => {
              const active = isActive(pathname, n)
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold"
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                      active ? 'bg-brand-100 text-brand-700' : 'text-slate-500'
                    }`}
                  >
                    <n.icon className="size-5" aria-hidden />
                  </span>
                  <span className={active ? 'text-brand-800' : 'text-slate-500'}>{n.label}</span>
                </NavLink>
              )
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                  secondary.some((n) => isActive(pathname, n)) ? 'bg-brand-100 text-brand-700' : 'text-slate-500'
                }`}
              >
                <Ellipsis className="size-5" aria-hidden />
              </span>
              <span className="text-slate-500">Lainnya</span>
            </button>
          </div>
        </nav>
      </div>

      {moreOpen && (
        <BottomSheet
          title={profile.display_name}
          subtitle={`@${profile.username} · ${unitText}`}
          onClose={() => setMoreOpen(false)}
        >
          <ul className="flex flex-col gap-2">
            {[...secondary, { to: '/admin/ganti-password', label: 'Ganti password', icon: KeyRound } as NavItem].map(
              (n) => (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 px-4 font-semibold transition hover:bg-slate-100"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs">
                      <n.icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1">{n.label}</span>
                    <ChevronRight className="size-5 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-red-50 px-4 font-semibold text-red-700 transition hover:bg-red-100"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-white shadow-xs">
                  <LogOut className="size-5" aria-hidden />
                </span>
                Keluar
              </button>
            </li>
          </ul>
        </BottomSheet>
      )}
    </div>
  )
}
