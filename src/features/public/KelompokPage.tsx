import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PublicHeader } from '../../components/PublicHeader'
import { ProgressBar } from '../../components/StatCard'
import { useNow } from '../../hooks/useNow'
import { useRealtime } from '../../hooks/useRealtime'
import { saveKelompok } from '../../lib/kelompokStore'
import { stat } from '../../lib/stats'
import { summarySessionText } from '../../lib/summaryText'
import type { ActivityCard, UnitLevel } from '../../lib/types'
import { fetchKelompokActivities, fetchStructure } from './api'

const LEVELS: { value: UnitLevel | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'kelompok', label: 'Kelompok' },
  { value: 'desa', label: 'Desa' },
  { value: 'daerah', label: 'Daerah' },
]

/** Kegiatan yang mengikutkan kelompok ini: yang sedang berjalan di atas, lalu jadwal terdekat. */
function sortCards(list: ActivityCard[]): ActivityCard[] {
  const rank = (c: ActivityCard) => (c.session_id ? 0 : c.next_opens_at ? 1 : 2)
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.next_opens_at && b.next_opens_at ? a.next_opens_at.localeCompare(b.next_opens_at) : 0) ||
      a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }),
  )
}

export function KelompokPage() {
  const { kelompokSlug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const level = (params.get('level') ?? '') as UnitLevel | ''
  const qc = useQueryClient()
  const structure = useQuery({ queryKey: ['structure'], queryFn: fetchStructure, staleTime: 5 * 60_000 })
  const kelompok = structure.data?.find((u) => u.level === 'kelompok' && u.slug === kelompokSlug)
  const desa = structure.data?.find((u) => u.id === kelompok?.parent_id)
  const key = ['kelompok-activities', kelompok?.id]
  const activities = useQuery({
    queryKey: key,
    queryFn: () => fetchKelompokActivities(kelompok!.id),
    enabled: !!kelompok,
    staleTime: 0,
  })

  useEffect(() => {
    if (kelompok) saveKelompok({ id: kelompok.id, slug: kelompok.slug, name: kelompok.name })
  }, [kelompok])

  useRealtime(kelompok ? `kelompok:${kelompok.id}` : null, [{ table: 'attendance' }, { table: 'sessions' }], () =>
    qc.invalidateQueries({ queryKey: key }),
  )
  // Muat ulang tepat saat sebuah sesi dibuka atau lewat batas pengisian.
  useNow(activities.data?.flatMap((c) => [c.session_closes_at, c.next_opens_at]) ?? [], () =>
    qc.invalidateQueries({ queryKey: key }),
  )

  const retry = () => void (structure.isError ? structure.refetch() : activities.refetch())
  const isError = structure.isError || activities.isError
  const loading = structure.isPending || (!!kelompok && activities.isPending)

  if (structure.data && !kelompok)
    return (
      <div className="mx-auto max-w-xl p-4 text-center">
        <p className="mt-16 text-xl font-bold">Kelompok tidak ditemukan</p>
        <Link
          to="/?ganti"
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 font-semibold text-white"
        >
          Pilih kelompok
        </Link>
      </div>
    )

  const list = sortCards((activities.data ?? []).filter((c) => !level || c.owner_level === level))

  return (
    <div className="min-h-dvh">
      <PublicHeader
        title={kelompok ? `Kelompok ${kelompok.name}` : 'Absensi'}
        subtitle={desa ? `Desa ${desa.name}` : undefined}
        left={
          <Link
            to="/?ganti"
            className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-brand-100"
          >
            ‹ Ganti kelompok
          </Link>
        }
      />
      <main className="mx-auto max-w-xl px-4 py-4">
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Tingkat kegiatan">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setParams(l.value ? { level: l.value } : {}, { replace: true })}
              className={`min-h-11 shrink-0 rounded-full px-4 font-semibold ring-1 ${
                level === l.value ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {loading && <p className="py-10 text-center text-muted">Memuat…</p>}
        {isError && (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p>Gagal memuat data. Periksa koneksi internet.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 min-h-12 rounded-xl bg-brand-700 px-5 font-semibold text-white"
            >
              Coba lagi
            </button>
          </div>
        )}
        {activities.data && list.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Belum ada kegiatan</p>
            <p className="mt-1 text-muted">
              {level ? 'Tidak ada kegiatan di tingkat ini.' : 'Pengurus belum menambahkan kegiatan.'}
            </p>
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {list.map((c) => {
            const all = stat(c.present, c.total)
            return (
              <li key={c.category_id}>
                <Link
                  to={`/k/${c.slug}`}
                  className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold break-words">
                        {c.name}{' '}
                        {c.pin_enabled && (
                          <span aria-label="Memakai PIN" title="Memakai PIN">
                            🔒
                          </span>
                        )}
                      </h2>
                      {c.owner_level !== 'kelompok' && (
                        <p className="text-sm font-medium text-brand-700">
                          Kegiatan {c.owner_level === 'desa' ? 'Desa' : 'Daerah'} {c.owner_name}
                        </p>
                      )}
                      <p className="text-muted">{summarySessionText(c)}</p>
                    </div>
                    {c.session_id && c.total > 0 && (
                      <span className="shrink-0 text-3xl font-bold tabular-nums text-brand-700">{all.percent}%</span>
                    )}
                  </div>
                  {c.session_id && c.total > 0 && (
                    <>
                      <div className="mt-3">
                        <ProgressBar percent={all.percent} />
                      </div>
                      <p className="mt-2 text-muted">
                        {c.present}/{c.total} hadir dari kelompok ini
                      </p>
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
