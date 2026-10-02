import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CalendarClock, CalendarX, ChevronLeft, Search, SearchX, UserRoundX } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { heroBackClass, PublicHeader } from '../../components/PublicHeader'
import { StatCard } from '../../components/StatCard'
import { StatusPill } from '../../components/StatusPill'
import { useToast } from '../../components/Toast'
import { Avatar, Button, buttonClass, EmptyState, inputClass } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { payloadValue, useRealtime } from '../../hooks/useRealtime'
import { errorCode, errorMessage } from '../../lib/errors'
import { getKelompok } from '../../lib/kelompokStore'
import { clearPin, getPin, setPin } from '../../lib/pinStore'
import { formatTimeRange, opensText } from '../../lib/sessionTime'
import { computeStats } from '../../lib/stats'
import { fetchCategoryPage, setAttendance, type CategoryPageData, type Participant } from './api'
import { PinPad } from './PinPad'
import { StatusSheet } from './StatusSheet'

export function CategoryPage() {
  const { slug = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['category', slug]
  // staleTime 0: setiap kali halaman dibuka, pengaturan kategori (mis. PIN) diambil ulang dari server.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => fetchCategoryPage(slug),
    staleTime: 0,
  })

  const saved = getKelompok()
  const [search, setSearch] = useState('')
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  // Default: kelompok yang tersimpan di perangkat; '' = semua kelompok.
  const [kelompokFilter, setKelompokFilter] = useState(saved?.id ?? '')
  const [sheetMember, setSheetMember] = useState<Participant | null>(null)
  // Dinaikkan saat PIN disimpan/dihapus agar gerbang PIN dievaluasi ulang.
  const [, setPinVersion] = useState(0)

  const sessionId = data?.session?.id
  useRealtime(
    data ? `category:${data.category.id}` : null,
    [{ table: 'attendance' }, { table: 'sessions', filter: `category_id=eq.${data?.category.id}` }],
    (table, payload) => {
      if (table === 'sessions' || payloadValue(payload, 'session_id') === sessionId) {
        void qc.invalidateQueries({ queryKey: key })
      }
    },
  )

  // Beralih tampilan tepat saat sesi berikutnya dibuka atau sesi berjalan lewat batas.
  useNow([data?.session?.closes_at, data?.next?.opens_at], () => void qc.invalidateQueries({ queryKey: key }))

  const kelompokOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of data?.members ?? []) m.set(p.kelompok_id, p.kelompok_name)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'id', { sensitivity: 'base' }))
  }, [data])
  // Kelompok tersimpan yang bukan peserta kegiatan ini diperlakukan sebagai "Semua kelompok".
  const kelompok = kelompokOptions.some(([id]) => id === kelompokFilter) ? kelompokFilter : ''
  const scoped = useMemo(
    () => (data ? (kelompok ? data.members.filter((m) => m.kelompok_id === kelompok) : data.members) : []),
    [data, kelompok],
  )

  const stats = useMemo(() => {
    if (!data) return null
    const present = new Set(data.statuses.filter((s) => s.counts_as_present).map((s) => s.id))
    return computeStats(scoped, data.attendance, present)
  }, [data, scoped])

  const emptyCount = useMemo(() => (data ? scoped.filter((m) => !data.attendance.has(m.id)).length : 0), [data, scoped])
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id')
    return scoped.filter(
      (m) => (!q || m.name.toLocaleLowerCase('id').includes(q)) && (!onlyEmpty || !data?.attendance.has(m.id)),
    )
  }, [scoped, search, onlyEmpty, data])
  const showKelompok = !kelompok && kelompokOptions.length > 1

  if (isPending)
    return (
      <div className="min-h-dvh">
        <div className="hero-bg h-44" />
        <div className="mx-auto -mt-6 flex max-w-xl flex-col gap-3 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-white shadow-card" />
          ))}
        </div>
      </div>
    )
  if (isError)
    return (
      <main className="mx-auto max-w-xl px-4 pt-20">
        <EmptyState
          icon={CalendarX}
          title="Gagal memuat data"
          action={<Button onClick={() => refetch()}>Coba lagi</Button>}
        >
          Periksa koneksi internet lalu coba lagi.
        </EmptyState>
      </main>
    )
  if (!data)
    return (
      <main className="mx-auto max-w-xl px-4 pt-20">
        <EmptyState
          icon={CalendarX}
          title="Kegiatan tidak ditemukan"
          action={
            <Link to="/" className={buttonClass('primary')}>
              Kembali ke beranda
            </Link>
          }
        >
          Kegiatan mungkin sudah dinonaktifkan pengurus.
        </EmptyState>
      </main>
    )

  const { category } = data
  const statusById = new Map(data.statuses.map((s) => [s.id, s]))

  function patchAttendance(memberId: string, statusId: string | null) {
    qc.setQueryData<CategoryPageData | null>(key, (d) => {
      if (!d) return d
      const attendance = new Map(d.attendance)
      if (statusId) attendance.set(memberId, statusId)
      else attendance.delete(memberId)
      return { ...d, attendance }
    })
  }

  async function save(member: Participant, statusId: string | null, previous: string | null, isUndo = false) {
    patchAttendance(member.id, statusId)
    try {
      await setAttendance({ categoryId: category.id, memberId: member.id, statusId, pin: getPin(category.id) })
      void qc.invalidateQueries({ queryKey: ['kelompok-activities'] })
      if (isUndo) {
        toast({ message: `Dibatalkan: ${member.name}` })
      } else {
        const label = statusId ? statusById.get(statusId)?.label : 'Belum'
        toast({
          message: `Tersimpan ✓ ${member.name}: ${label}`,
          action: { label: 'Batal', onClick: () => void save(member, previous, statusId, true) },
        })
      }
    } catch (e) {
      patchAttendance(member.id, previous)
      const code = errorCode(e)
      if (code === 'PIN_INVALID' || code === 'PIN_REQUIRED') {
        clearPin(category.id)
        setPinVersion((v) => v + 1)
        void qc.invalidateQueries({ queryKey: key })
        toast({
          tone: 'error',
          message:
            code === 'PIN_REQUIRED'
              ? 'Kegiatan ini sekarang memakai PIN. Masukkan PIN.'
              : 'PIN sudah berubah. Masukkan PIN baru.',
        })
      } else if (code === 'NO_ACTIVE_SESSION') {
        void qc.invalidateQueries({ queryKey: key })
        toast({ tone: 'error', message: 'Sesi sudah selesai atau belum dibuka. Status tidak disimpan.' })
      } else {
        toast({ tone: 'error', message: `Gagal menyimpan. ${errorMessage(e)}` })
      }
    }
  }

  const locked = category.pin_enabled && !getPin(category.id)

  return (
    <div className="min-h-dvh pb-24">
      <PublicHeader
        title={category.name}
        subtitle={
          data.session
            ? [data.session.label, formatTimeRange(data.session.start_time, data.session.end_time)]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        note={data.session?.note}
        left={
          <Link to={saved ? `/g/${saved.slug}` : '/'} className={heroBackClass}>
            <ChevronLeft className="size-5" aria-hidden /> Semua kegiatan
          </Link>
        }
      />
      <main className="relative mx-auto -mt-4 max-w-xl px-4">
        {!data.session ? (
          <section className="animate-rise rounded-[2rem] border border-line/70 bg-white p-6 text-center shadow-card">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <CalendarClock className="size-7" aria-hidden />
            </span>
            {data.next?.opens_at ? (
              <>
                <p className="text-lg font-semibold">{opensText(data.next.label, data.next.opens_at)}</p>
                {data.next.end_time && (
                  <p className="mt-1 text-muted">
                    Sesi {formatTimeRange(data.next.start_time, data.next.end_time)} WIB. Halaman ini terbuka otomatis
                    saat absen dibuka.
                  </p>
                )}
                {data.next.note && <p className="mt-1 break-words text-muted">📝 {data.next.note}</p>}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">Belum ada jadwal sesi.</p>
                <p className="mt-1 text-muted">Tunggu jadwal berikutnya dari pengurus.</p>
              </>
            )}
          </section>
        ) : locked ? (
          <PinPad
            categoryId={category.id}
            onSuccess={(pin) => {
              setPin(category.id, pin)
              setPinVersion((v) => v + 1)
            }}
          />
        ) : (
          <>
            {stats && (
              <section className="animate-rise grid grid-cols-2 gap-3" aria-label="Persentase kehadiran">
                <div className="col-span-2">
                  <StatCard label="Kehadiran" stat={stats.all} large />
                </div>
                <StatCard label="Laki-laki" stat={stats.L} />
                <StatCard label="Perempuan" stat={stats.P} />
              </section>
            )}

            <div className="sticky top-0 z-10 -mx-4 mt-4 flex flex-col gap-2 bg-surface/90 px-4 pt-3 pb-3 backdrop-blur-md">
              {kelompokOptions.length > 1 && (
                <>
                  <label className="sr-only" htmlFor="kelompok">
                    Kelompok
                  </label>
                  <select
                    id="kelompok"
                    value={kelompok}
                    onChange={(e) => setKelompokFilter(e.target.value)}
                    className={`${inputClass} min-h-13 text-lg font-semibold`}
                  >
                    <option value="">Semua kelompok</option>
                    {kelompokOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        Kelompok {name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="relative">
                <label className="sr-only" htmlFor="search">
                  Cari nama
                </label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="search"
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Cari nama…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} min-h-14 pl-12 text-lg`}
                />
              </div>
              <div className="flex gap-2" role="group" aria-label="Tampilkan">
                {[
                  [false, `Semua (${scoped.length})`],
                  [true, `Belum mengisi (${emptyCount})`],
                ].map(([value, label]) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={onlyEmpty === value}
                    onClick={() => setOnlyEmpty(value as boolean)}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
                      onlyEmpty === value ? 'bg-ink text-white' : 'border border-line bg-white text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {scoped.length === 0 ? (
              <EmptyState icon={UserRoundX} title="Belum ada peserta">
                Belum ada peserta untuk kegiatan ini.
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={onlyEmpty && !search.trim() ? 'Semua sudah mengisi 🎉' : 'Nama tidak ditemukan'}
              >
                {onlyEmpty && !search.trim()
                  ? 'Tidak ada lagi yang belum mengisi.'
                  : 'Coba ejaan lain atau periksa filter.'}
              </EmptyState>
            ) : (
              <ul className="overflow-hidden rounded-3xl border border-line/70 bg-white shadow-card">
                {filtered.map((m) => (
                  <li key={m.id} className="border-b border-slate-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSheetMember(m)}
                      className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-50 active:bg-brand-50"
                    >
                      <Avatar name={m.name} tone={m.gender} />
                      <span className="min-w-0 flex-1 text-lg font-semibold break-words">
                        {m.name}
                        {showKelompok && (
                          <span className="block text-sm font-normal text-muted">{m.kelompok_name}</span>
                        )}
                      </span>
                      <StatusPill status={statusById.get(data.attendance.get(m.id) ?? '')} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {sheetMember && !locked && data.session && (
        <StatusSheet
          member={sheetMember}
          statuses={data.statuses}
          currentStatusId={data.attendance.get(sheetMember.id)}
          onClose={() => setSheetMember(null)}
          onPick={(statusId) => {
            const member = sheetMember
            setSheetMember(null)
            void save(member, statusId, data.attendance.get(member.id) ?? null)
          }}
        />
      )}
    </div>
  )
}
