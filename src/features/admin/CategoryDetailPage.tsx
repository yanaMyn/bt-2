import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ErrorText } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { getCategory } from './api'
import { InactiveBadge } from './InactiveBadge'
import { CategoryMembersTab } from './CategoryMembersTab'
import { CategorySessionsTab } from './CategorySessionsTab'
import { CategorySettingsTab } from './CategorySettingsTab'
import { CategoryStatusesTab } from './CategoryStatusesTab'

const TABS = [
  { id: 'anggota', label: 'Anggota' },
  { id: 'status', label: 'Status' },
  { id: 'sesi', label: 'Sesi & Reset' },
  { id: 'pengaturan', label: 'Pengaturan' },
] as const

export function CategoryDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'anggota'
  const {
    data: category,
    isPending,
    error,
  } = useQuery({
    queryKey: ['admin', 'category', id],
    queryFn: () => getCategory(id),
  })

  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>
  if (!category)
    return (
      <div>
        <p className="font-bold">Kategori tidak ditemukan.</p>
        <Link to="/admin/kategori" className="text-brand-700">
          ‹ Kembali
        </Link>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/admin/kategori" className="inline-flex min-h-11 items-center text-brand-700">
          ‹ Semua kategori
        </Link>
        <h1 className="text-2xl font-bold break-words">
          {category.name} {category.pin_enabled && <span title="PIN aktif">🔒</span>}{' '}
          {!category.is_active && <InactiveBadge />}
        </h1>
        {category.is_active ? (
          <Link to={`/k/${category.slug}`} target="_blank" className="text-sm text-brand-700 underline">
            Buka halaman publik (/k/{category.slug})
          </Link>
        ) : (
          <p className="text-sm text-muted">Tersembunyi dari halaman orang tua. Aktifkan di tab Pengaturan.</p>
        )}
      </div>
      <nav className="flex flex-wrap gap-1 rounded-2xl bg-gray-200/70 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={`min-h-11 flex-1 rounded-xl px-3 font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-white shadow-sm' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'anggota' && <CategoryMembersTab category={category} />}
      {tab === 'status' && <CategoryStatusesTab category={category} />}
      {tab === 'sesi' && <CategorySessionsTab category={category} />}
      {tab === 'pengaturan' && <CategorySettingsTab category={category} />}
    </div>
  )
}
