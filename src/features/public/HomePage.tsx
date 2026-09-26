import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router'
import { PublicHeader } from '../../components/PublicHeader'
import { childrenOf } from '../../lib/criteria'
import { getKelompok } from '../../lib/kelompokStore'
import { fetchStructure } from './api'

const itemClass =
  'flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left text-lg font-semibold shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]'

/** Beranda: pilih Desa lalu Kelompok. Kelompok yang pernah dipilih langsung dibuka. */
export function HomePage() {
  const [params, setParams] = useSearchParams()
  const changing = params.has('ganti')
  const saved = getKelompok()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['structure'],
    queryFn: fetchStructure,
    staleTime: 5 * 60_000,
    enabled: changing || !saved,
  })

  if (saved && !changing) return <Navigate to={`/g/${saved.slug}`} replace />

  const desaSlug = params.get('desa')
  const daerah = data?.find((u) => u.level === 'daerah')
  const desaList = data ? childrenOf(data, daerah?.id ?? null) : []
  const desa = desaSlug ? data?.find((u) => u.level === 'desa' && u.slug === desaSlug) : undefined
  const kelompokList = data && desa ? childrenOf(data, desa.id) : []

  const pickDesa = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('desa', slug)
    else next.delete('desa')
    setParams(next)
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader
        title={desa ? `Desa ${desa.name}` : 'Absensi'}
        subtitle={desa ? 'Pilih kelompok Anda' : 'Pilih desa Anda'}
        left={
          desa ? (
            <button
              type="button"
              onClick={() => pickDesa(null)}
              className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-brand-100"
            >
              ‹ Pilih desa
            </button>
          ) : saved ? (
            <Link
              to={`/g/${saved.slug}`}
              className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-brand-100"
            >
              ‹ Kembali ke {saved.name}
            </Link>
          ) : undefined
        }
      />
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
        {data && !desa && desaList.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Belum ada desa</p>
            <p className="mt-1 text-muted">Pengurus belum menyiapkan data. Silakan cek lagi nanti.</p>
          </div>
        )}
        {data && desa && kelompokList.length === 0 && (
          <p className="py-10 text-center text-muted">Belum ada kelompok di desa ini.</p>
        )}
        <ul className="flex flex-col gap-3">
          {!desa &&
            desaList.map((d) => (
              <li key={d.id}>
                <button type="button" className={itemClass} onClick={() => pickDesa(d.slug)}>
                  <span className="break-words">{d.name}</span>
                  <span aria-hidden className="text-2xl text-muted">
                    ›
                  </span>
                </button>
              </li>
            ))}
          {kelompokList.map((k) => (
            <li key={k.id}>
              <Link to={`/g/${k.slug}`} className={itemClass}>
                <span className="break-words">{k.name}</span>
                <span aria-hidden className="text-2xl text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
