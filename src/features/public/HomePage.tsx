import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { heroBackClass, PublicHeader } from '../../components/PublicHeader'
import { Button, EmptyState } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import { getKelompok } from '../../lib/kelompokStore'
import { fetchStructure } from './api'

const itemClass =
  'group flex min-h-[4.5rem] w-full items-center gap-4 rounded-3xl border border-line/70 bg-white px-4 py-3 text-left shadow-card transition hover:border-brand-200 hover:shadow-float active:scale-[0.99]'

function Item({ icon: Icon, name, hint }: { icon: typeof MapPin; name: string; hint: string }) {
  return (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold break-words">{name}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
    </>
  )
}

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

  const kelompokCount = (desaId: string) => (data ? childrenOf(data, desaId).length : 0)

  return (
    <div className="min-h-dvh pb-10">
      <PublicHeader
        eyebrow={desa ? 'Langkah 2 dari 2' : 'Langkah 1 dari 2'}
        title={desa ? `Desa ${desa.name}` : 'Absensi Pengajian'}
        subtitle={desa ? 'Pilih kelompok Anda' : 'Pilih desa Anda untuk mulai mengisi kehadiran'}
        left={
          desa ? (
            <button type="button" onClick={() => pickDesa(null)} className={heroBackClass}>
              <ChevronLeft className="size-5" aria-hidden /> Pilih desa
            </button>
          ) : saved ? (
            <Link to={`/g/${saved.slug}`} className={heroBackClass}>
              <ChevronLeft className="size-5" aria-hidden /> Kembali ke {saved.name}
            </Link>
          ) : undefined
        }
      />
      <main className="relative mx-auto -mt-4 max-w-xl px-4">
        {isPending && (
          <ul className="flex flex-col gap-3" aria-label="Memuat">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[4.5rem] animate-pulse rounded-3xl bg-white shadow-card" />
            ))}
          </ul>
        )}
        {isError && (
          <EmptyState
            icon={MapPin}
            title="Gagal memuat data"
            action={<Button onClick={() => refetch()}>Coba lagi</Button>}
          >
            Periksa koneksi internet lalu coba lagi.
          </EmptyState>
        )}
        {data && !desa && desaList.length === 0 && (
          <EmptyState icon={MapPin} title="Belum ada desa">
            Pengurus belum menyiapkan data. Silakan cek lagi nanti.
          </EmptyState>
        )}
        {data && desa && kelompokList.length === 0 && (
          <EmptyState icon={Users} title="Belum ada kelompok">
            Desa ini belum punya kelompok.
          </EmptyState>
        )}
        <ul className="flex flex-col gap-3">
          {!desa &&
            desaList.map((d, i) => (
              <li key={d.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <button type="button" className={itemClass} onClick={() => pickDesa(d.slug)}>
                  <Item icon={MapPin} name={d.name} hint={`${kelompokCount(d.id)} kelompok`} />
                </button>
              </li>
            ))}
          {kelompokList.map((k, i) => (
            <li key={k.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <Link to={`/g/${k.slug}`} className={itemClass}>
                <Item icon={Users} name={k.name} hint="Lihat kegiatan & isi kehadiran" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-sm text-muted">
          Pengurus?{' '}
          <Link to="/admin/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Masuk sebagai admin
          </Link>
        </p>
      </main>
    </div>
  )
}
