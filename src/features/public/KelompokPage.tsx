import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { CalendarClock, CalendarX, ChevronRight, Lock, RefreshCw, Users } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { heroBackClass, PublicHeader } from '../../components/PublicHeader'
import { ProgressRing } from '../../components/StatCard'
import { Badge, Button, buttonClass, EmptyState, LiveDot } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useLiveChannel } from '../../hooks/useLiveChannel'
import { payloadValue, useRealtime, type RealtimeBinding } from '../../hooks/useRealtime'
import { saveKelompok } from '../../lib/kelompokStore'
import { stat } from '../../lib/stats'
import { summarySessionText } from '../../lib/summaryText'
import type { ActivityCard, UnitLevel } from '../../lib/types'
import { fetchKelompokActivities, fetchStructure } from './api'

const MAX_IN_FILTER = 100

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
  const resync = () => void qc.invalidateQueries({ queryKey: key })
  const live = useLiveChannel(resync)
  const activities = useQuery({
    queryKey: key,
    queryFn: () => fetchKelompokActivities(kelompok!.id),
    enabled: !!kelompok,
    staleTime: 0,
    refetchInterval: live.refetchInterval,
  })

  useEffect(() => {
    if (kelompok) saveKelompok({ id: kelompok.id, slug: kelompok.slug, name: kelompok.name })
  }, [kelompok])

  // Pembaruan langsung (design D1, D3): hanya isian sesi berjalan yang tampil di halaman ini
  // (difilter di server) dan perubahan jadwal sesi; rentetan event = satu kali muat ulang.
  const runningIds = useMemo(
    () => [...new Set((activities.data ?? []).flatMap((c) => (c.session_id ? [c.session_id] : [])))].sort(),
    [activities.data],
  )
  const reload = useDebouncedCallback(resync, 3000, 10_000)
  const bindings = useMemo<RealtimeBinding[]>(() => {
    if (runningIds.length === 0) return [{ table: 'sessions' }]
    // Filter `in` dibatasi 100 nilai; di atas itu event disaring di klien.
    const filter = runningIds.length <= MAX_IN_FILTER ? `session_id=in.(${runningIds.join(',')})` : undefined
    return [
      { table: 'attendance', event: 'INSERT', filter },
      { table: 'attendance', event: 'UPDATE', filter },
      { table: 'attendance', event: 'DELETE' },
      { table: 'sessions' },
    ]
  }, [runningIds])
  useRealtime(
    kelompok && live.enabled ? `kelompok:${kelompok.id}` : null,
    bindings,
    (table, payload) => {
      if (table === 'attendance' && !runningIds.includes(String(payloadValue(payload, 'session_id')))) return
      reload.trigger()
    },
    live.onStatus,
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
      <main className="mx-auto max-w-xl px-4 pt-20">
        <EmptyState
          icon={Users}
          title="Kelompok tidak ditemukan"
          action={
            <Link to="/?ganti" className={buttonClass('primary')}>
              Pilih kelompok
            </Link>
          }
        >
          Tautan ini mungkin sudah berubah.
        </EmptyState>
      </main>
    )

  const all = activities.data ?? []
  const list = sortCards(all.filter((c) => !level || c.owner_level === level))
  const runningCount = all.filter((c) => c.session_id).length

  return (
    <div className="min-h-dvh pb-10">
      <PublicHeader
        eyebrow={desa ? `Desa ${desa.name}` : undefined}
        title={kelompok ? `Kelompok ${kelompok.name}` : 'Absensi'}
        subtitle={
          activities.data
            ? runningCount > 0
              ? `${runningCount} kegiatan sedang berlangsung`
              : 'Tidak ada kegiatan yang sedang berlangsung'
            : undefined
        }
        left={
          <Link to="/?ganti" className={heroBackClass}>
            <RefreshCw className="size-4" aria-hidden /> Ganti kelompok
          </Link>
        }
      >
        <div
          className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4"
          role="group"
          aria-label="Tingkat kegiatan"
        >
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setParams(l.value ? { level: l.value } : {}, { replace: true })}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-[0.97] ${
                level === l.value
                  ? 'bg-white text-brand-800 shadow-float'
                  : 'bg-white/12 text-white ring-1 ring-white/25 hover:bg-white/20'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </PublicHeader>
      <main className="relative mx-auto -mt-4 max-w-xl px-4">
        {loading && (
          <ul className="flex flex-col gap-3" aria-label="Memuat">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-32 animate-pulse rounded-3xl bg-white shadow-card" />
            ))}
          </ul>
        )}
        {isError && (
          <EmptyState icon={CalendarX} title="Gagal memuat data" action={<Button onClick={retry}>Coba lagi</Button>}>
            Periksa koneksi internet lalu coba lagi.
          </EmptyState>
        )}
        {activities.data && list.length === 0 && (
          <EmptyState icon={CalendarX} title="Belum ada kegiatan">
            {level ? 'Tidak ada kegiatan di tingkat ini.' : 'Pengurus belum menambahkan kegiatan.'}
          </EmptyState>
        )}
        <ul className="flex flex-col gap-3">
          {list.map((c, i) => {
            const running = Boolean(c.session_id)
            const pct = stat(c.present, c.total)
            return (
              <li key={c.category_id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link
                  to={`/k/${c.slug}`}
                  className={`group block rounded-3xl border bg-white p-4 shadow-card transition hover:shadow-float active:scale-[0.99] ${
                    running ? 'border-brand-200 ring-1 ring-brand-100' : 'border-line/70'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {running ? (
                      <Badge tone="brand">
                        <LiveDot /> Sedang berlangsung
                      </Badge>
                    ) : c.next_opens_at ? (
                      <Badge tone="info">
                        <CalendarClock className="size-3.5" aria-hidden /> Terjadwal
                      </Badge>
                    ) : (
                      <Badge>Belum ada jadwal</Badge>
                    )}
                    {c.owner_level !== 'kelompok' && (
                      <Badge tone="warning">
                        {c.owner_level === 'desa' ? 'Desa' : 'Daerah'} {c.owner_name}
                      </Badge>
                    )}
                    {c.pin_enabled && (
                      <Badge>
                        <Lock className="size-3" aria-hidden /> PIN
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold tracking-tight break-words">{c.name}</h2>
                      <p className="mt-0.5 text-muted">{summarySessionText(c)}</p>
                      {running && c.total > 0 && (
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {c.present} dari {c.total} sudah hadir
                        </p>
                      )}
                    </div>
                    {running && c.total > 0 ? (
                      <div className="relative">
                        <ProgressRing percent={pct.percent} size={68} stroke={7} />
                        <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold tabular-nums text-brand-700">
                          {pct.percent}%
                        </span>
                      </div>
                    ) : (
                      <ChevronRight
                        className="size-6 shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    )}
                  </div>
                  {running && (
                    <span className={buttonClass('primary', 'mt-4 w-full')}>
                      Isi kehadiran <ChevronRight className="size-5" aria-hidden />
                    </span>
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
