import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { ToastProvider } from './components/Toast'
import { CategoryPage } from './features/public/CategoryPage'
import { HomePage } from './features/public/HomePage'

// Panel admin (termasuk SheetJS) dimuat terpisah agar halaman orang tua tetap ringan.
const admin = () => import('./features/admin')
const LoginPage = lazy(() => admin().then((m) => ({ default: m.LoginPage })))
const RequireAdmin = lazy(() => admin().then((m) => ({ default: m.RequireAdmin })))
const AdminLayout = lazy(() => admin().then((m) => ({ default: m.AdminLayout })))
const CategoriesPage = lazy(() => admin().then((m) => ({ default: m.CategoriesPage })))
const CategoryDetailPage = lazy(() => admin().then((m) => ({ default: m.CategoryDetailPage })))
const MembersPage = lazy(() => admin().then((m) => ({ default: m.MembersPage })))
const ImportPage = lazy(() => admin().then((m) => ({ default: m.ImportPage })))
const ReportsPage = lazy(() => admin().then((m) => ({ default: m.ReportsPage })))

const loading = <p className="py-16 text-center text-muted">Memuat…</p>
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
    <div className="mx-auto max-w-xl p-4 text-center">
      <p className="mt-16 text-xl font-bold">Halaman tidak ditemukan</p>
      <a href="/" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 font-semibold text-white">
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
      { path: '/k/:slug', element: <CategoryPage /> },
      { path: '/admin/login', element: suspend(<LoginPage />) },
      {
        path: '/admin',
        element: suspend(<RequireAdmin />),
        children: [
          {
            element: suspend(<AdminLayout />),
            children: [
              { index: true, element: <Navigate to="/admin/kategori" replace /> },
              { path: 'kategori', element: suspend(<CategoriesPage />) },
              { path: 'kategori/:id', element: suspend(<CategoryDetailPage />) },
              { path: 'anggota', element: suspend(<MembersPage />) },
              { path: 'import', element: suspend(<ImportPage />) },
              { path: 'laporan', element: suspend(<ReportsPage />) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
