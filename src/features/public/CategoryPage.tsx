import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PublicHeader } from '../../components/PublicHeader'
import { StatCard } from '../../components/StatCard'
import { StatusPill } from '../../components/StatusPill'
import { useToast } from '../../components/Toast'
import { payloadValue, useRealtime } from '../../hooks/useRealtime'
import { errorCode, errorMessage } from '../../lib/errors'
import { clearPin, getPin, setPin } from '../../lib/pinStore'
import { computeStats } from '../../lib/stats'
import type { Member } from '../../lib/types'
import { fetchCategoryPage, setAttendance, type CategoryPageData } from './api'
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

  const [search, setSearch] = useState('')
  const [sheetMember, setSheetMember] = useState<Member | null>(null)
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

  const stats = useMemo(() => {
    if (!data) return null
    const present = new Set(data.statuses.filter((s) => s.counts_as_present).map((s) => s.id))
    return computeStats(data.members, data.attendance, present)
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id')
    if (!data) return []
    return q ? data.members.filter((m) => m.name.toLocaleLowerCase('id').includes(q)) : data.members
  }, [data, search])

  if (isPending) return <p className="py-16 text-center text-muted">Memuat…</p>
  if (isError)
    return (
      <div className="mx-auto max-w-xl p-4 text-center">
        <p className="mt-10">Gagal memuat data. Periksa koneksi internet.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 min-h-12 rounded-xl bg-brand-700 px-5 font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    )
  if (!data)
    return (
      <div className="mx-auto max-w-xl p-4 text-center">
        <p className="mt-16 text-xl font-bold">Kategori tidak ditemukan</p>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-5 font-semibold text-white"
        >
          Kembali ke beranda
        </Link>
      </div>
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

  async function save(member: Member, statusId: string | null, previous: string | null, isUndo = false) {
    patchAttendance(member.id, statusId)
    try {
      await setAttendance({ categoryId: category.id, memberId: member.id, statusId, pin: getPin(category.id) })
      void qc.invalidateQueries({ queryKey: ['summaries'] })
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
              ? 'Kategori ini sekarang memakai PIN. Masukkan PIN.'
              : 'PIN sudah berubah. Masukkan PIN baru.',
        })
      } else if (code === 'NO_ACTIVE_SESSION') {
        void qc.invalidateQueries({ queryKey: key })
        toast({ tone: 'error', message: 'Sesi sudah diakhiri. Status tidak disimpan.' })
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
        subtitle={data.session?.label ?? 'Belum ada sesi berjalan'}
        note={data.session?.note}
        left={
          <Link to="/" className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-brand-100">
            ‹ Semua kategori
          </Link>
        }
      />
      <main className="mx-auto max-w-xl px-4">
        {!data.session ? (
          <section className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-lg font-semibold">Sesi sudah diakhiri.</p>
            <p className="mt-1 text-muted">Tunggu sesi berikutnya dari pengurus.</p>
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
              <section className="-mt-3 grid grid-cols-2 gap-3" aria-label="Persentase kehadiran">
                <div className="col-span-2">
                  <StatCard label="Kehadiran" stat={stats.all} large />
                </div>
                <StatCard label="Laki-laki" stat={stats.L} />
                <StatCard label="Perempuan" stat={stats.P} />
              </section>
            )}

            <div className="sticky top-0 z-10 -mx-4 mt-4 bg-surface/95 px-4 py-3 backdrop-blur">
              <label className="sr-only" htmlFor="search">
                Cari nama
              </label>
              <input
                id="search"
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="🔍  Cari nama…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-13 w-full rounded-2xl border border-gray-300 bg-white px-4 text-lg outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            {data.members.length === 0 ? (
              <p className="py-10 text-center text-muted">Belum ada anggota di kategori ini.</p>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-muted">Nama tidak ditemukan</p>
            ) : (
              <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                {filtered.map((m) => (
                  <li key={m.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSheetMember(m)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-gray-50"
                    >
                      <span className="min-w-0 flex-1 text-lg break-words">{m.name}</span>
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
