import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { ToastProvider } from './components/Toast'
import { CategoryPage } from './features/public/CategoryPage'
import { HomePage } from './features/public/HomePage'
import { KelompokPage } from './features/public/KelompokPage'

// Panel admin (termasuk SheetJS) dimuat terpisah agar halaman orang tua tetap ringan.
const admin = () => import('./features/admin')
const LoginPage = lazy(() => admin().then((m) => ({ default: m.LoginPage })))
const RequireAdmin = lazy(() => admin().then((m) => ({ default: m.RequireAdmin })))
const AdminLayout = lazy(() => admin().then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => admin().then((m) => ({ default: m.DashboardPage })))
const ChangePasswordPage = lazy(() => admin().then((m) => ({ default: m.ChangePasswordPage })))
const KegiatanPage = lazy(() => admin().then((m) => ({ default: m.KegiatanPage })))
const KegiatanDetailPage = lazy(() => admin().then((m) => ({ default: m.KegiatanDetailPage })))
const JamaahPage = lazy(() => admin().then((m) => ({ default: m.JamaahPage })))
const ImportPage = lazy(() => admin().then((m) => ({ default: m.ImportPage })))
const TransfersPage = lazy(() => admin().then((m) => ({ default: m.TransfersPage })))
const StructurePage = lazy(() => admin().then((m) => ({ default: m.StructurePage })))
const AdminsPage = lazy(() => admin().then((m) => ({ default: m.AdminsPage })))
const TemplatesPage = lazy(() => admin().then((m) => ({ default: m.TemplatesPage })))
const ReportsPage = lazy(() => admin().then((m) => ({ default: m.ReportsPage })))

const loading = (
  <div className="flex justify-center py-20" aria-label="Memuat">
    <span className="size-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
  </div>
)
const suspend = (el: ReactNode) => <Suspense fallback={loading}>{el}</Suspense>

function Root() {
  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  )
}

function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-extrabold tracking-tight text-brand-200">404</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">Halaman tidak ditemukan</p>
      <p className="mt-1 text-muted">Tautan mungkin salah atau sudah tidak berlaku.</p>
      <a
        href="/"
        className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-6 font-semibold text-white shadow-brand"
      >
        Ke beranda
      </a>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/g/:kelompokSlug', element: <KelompokPage /> },
      { path: '/k/:slug', element: <CategoryPage /> },
      { path: '/admin/login', element: suspend(<LoginPage />) },
      {
        path: '/admin',
        element: suspend(<RequireAdmin />),
        children: [
          { path: 'ganti-password', element: suspend(<ChangePasswordPage />) },
          {
            element: suspend(<AdminLayout />),
            children: [
              { index: true, element: suspend(<DashboardPage />) },
              { path: 'kegiatan', element: suspend(<KegiatanPage />) },
              { path: 'kegiatan/:id', element: suspend(<KegiatanDetailPage />) },
              { path: 'jamaah', element: suspend(<JamaahPage />) },
              { path: 'jamaah/import', element: suspend(<ImportPage />) },
              { path: 'perpindahan', element: suspend(<TransfersPage />) },
              { path: 'struktur', element: suspend(<StructurePage />) },
              { path: 'akun', element: suspend(<AdminsPage />) },
              { path: 'templat', element: suspend(<TemplatesPage />) },
              { path: 'laporan', element: suspend(<ReportsPage />) },
              // Tautan lama sebelum hierarki.
              { path: 'kategori/*', element: <Navigate to="/admin/kegiatan" replace /> },
              { path: 'anggota', element: <Navigate to="/admin/jamaah" replace /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
