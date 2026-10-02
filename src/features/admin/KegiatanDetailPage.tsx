import { CalendarX, ExternalLink, Lock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { Badge, buttonClass, EmptyState, ErrorText, PageHeader, Segmented } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { getCategory } from './api'
import { InactiveBadge } from './InactiveBadge'
import { ParticipantsTab } from './ParticipantsTab'
import { CategorySessionsTab } from './CategorySessionsTab'
import { CategorySettingsTab } from './CategorySettingsTab'
import { CategoryStatusesTab } from './CategoryStatusesTab'

const TABS = [
  { id: 'peserta', label: 'Peserta' },
  { id: 'status', label: 'Status' },
  { id: 'sesi', label: 'Sesi' },
  { id: 'pengaturan', label: 'Pengaturan' },
] as const

export function KegiatanDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'peserta'
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
      <EmptyState
        icon={CalendarX}
        title="Kegiatan tidak ditemukan"
        action={
          <Link to="/admin/kegiatan" className={buttonClass('primary')}>
            Kembali ke kegiatan
          </Link>
        }
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ to: '/admin/kegiatan', label: 'Semua kegiatan' }}
        title={category.name}
        description={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {category.pin_enabled && (
              <Badge>
                <Lock className="size-3" aria-hidden /> PIN aktif
              </Badge>
            )}
            {!category.is_active && <InactiveBadge />}
            {category.is_active ? (
              <a
                href={`/k/${category.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden /> Buka halaman publik
              </a>
            ) : (
              <span className="text-sm">Tersembunyi dari halaman orang tua. Aktifkan di tab Pengaturan.</span>
            )}
          </span>
        }
      />
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <Segmented
          label="Bagian kegiatan"
          value={tab}
          options={TABS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(id) => setParams({ tab: id }, { replace: true })}
          className="min-w-max"
        />
      </div>
      {tab === 'peserta' && <ParticipantsTab category={category} />}
      {tab === 'status' && <CategoryStatusesTab category={category} />}
      {tab === 'sesi' && <CategorySessionsTab category={category} />}
      {tab === 'pengaturan' && <CategorySettingsTab category={category} />}
    </div>
  )
}
