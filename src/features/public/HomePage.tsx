import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PublicHeader } from '../../components/PublicHeader'
import { ProgressBar } from '../../components/StatCard'
import { useRealtime } from '../../hooks/useRealtime'
import { stat } from '../../lib/stats'
import { fetchSummaries } from './api'

export function HomePage() {
  const qc = useQueryClient()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['summaries'],
    queryFn: fetchSummaries,
    staleTime: 0,
  })

  useRealtime('home', [{ table: 'attendance' }, { table: 'sessions' }], () =>
    qc.invalidateQueries({ queryKey: ['summaries'] }),
  )

  return (
    <div className="min-h-dvh">
      <PublicHeader title="Absensi" subtitle="Pilih kategori untuk mengisi kehadiran" />
      <main className="mx-auto max-w-xl px-4 py-4">
        {isPending && <p className="py-10 text-center text-muted">Memuat…</p>}
        {isError && (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p>Gagal memuat data. Periksa koneksi internet.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 min-h-12 rounded-xl bg-brand-700 px-5 font-semibold text-white"
            >
              Coba lagi
            </button>
          </div>
        )}
        {data && data.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Belum ada kategori</p>
            <p className="mt-1 text-muted">Admin belum menambahkan kategori. Silakan cek lagi nanti.</p>
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {data?.map((c) => {
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
                      <p className="text-muted">{c.session_label ?? 'Belum ada sesi berjalan'}</p>
                    </div>
                    {c.session_id && (
                      <span className="shrink-0 text-3xl font-bold tabular-nums text-brand-700">{all.percent}%</span>
                    )}
                  </div>
                  {c.session_id && (
                    <>
                      <div className="mt-3">
                        <ProgressBar percent={all.percent} />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-muted">
                        <span>
                          {c.present}/{c.total} hadir
                        </span>
                        <span className="tabular-nums">
                          L {stat(c.present_l, c.total_l).percent}% · P {stat(c.present_p, c.total_p).percent}%
                        </span>
                      </div>
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
