import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { formatDateShort, presetRange } from '../../lib/dateRange'
import { errorMessage } from '../../lib/errors'
import { markDuplicates, MAX_SCHEDULE, recurringDates, WEEKDAYS } from '../../lib/recurring'
import { sessionRecap } from '../../lib/reports'
import { formatSessionDate, todayJakarta } from '../../lib/sessionLabel'
import { formatGrace, formatTimeRange, jakartaTime, sessionState, type SessionState } from '../../lib/sessionTime'
import type { Category, Session } from '../../lib/types'
import {
  deleteSession,
  endPreview,
  endSession,
  finalizeDueSessions,
  loadReportData,
  scheduleSessions,
  updateSession,
  type EndPreview,
} from './api'
import { SessionTimeFields, timesValid, type TimeFields } from './SessionTimeFields'

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

const STATE_BADGE: Record<SessionState, { label: string; className: string }> = {
  dijadwalkan: { label: 'dijadwalkan', className: 'bg-blue-50 text-blue-800' },
  berjalan: { label: 'berjalan', className: 'bg-brand-50 text-brand-800' },
  selesai: { label: 'selesai', className: 'bg-gray-100 text-gray-700' },
}

const DEFAULT_TIMES: TimeFields = { start: '19:30', end: '21:00', grace: 0, note: '' }

export function CategorySessionsTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const reportKey = ['admin', 'report', category.id]
  const { data, isPending, error, refetch } = useQuery({
    queryKey: reportKey,
    queryFn: () => loadReportData(category.id),
  })
  const [ending, setEnding] = useState<{ session: Session; preview: EndPreview } | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState<Session | null>(null)

  // Cadangan bila pg_cron belum aktif: tutup sesi yang lewat batas saat tab dibuka.
  useEffect(() => {
    finalizeDueSessions()
      .then((n) => {
        if (n > 0) void refetch()
      })
      .catch(() => {})
  }, [refetch])

  const now = useNow(
    data?.sessions.flatMap((s) => (s.closed_at ? [] : [s.opens_at, s.closes_at])) ?? [],
    () => void refetch(),
  )

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  // Dijadwalkan terdekat di atas, lalu berjalan, lalu selesai terbaru.
  const sessions = useMemo(() => {
    const list = (data?.sessions ?? []).map((s) => ({ s, state: sessionState(s, now) }))
    const order: Record<SessionState, number> = { dijadwalkan: 0, berjalan: 1, selesai: 2 }
    return list.sort((a, b) => {
      if (a.state !== b.state) return order[a.state] - order[b.state]
      const ka = a.s.opens_at ?? a.s.started_at
      const kb = b.s.opens_at ?? b.s.started_at
      return a.state === 'dijadwalkan' ? ka.localeCompare(kb) : kb.localeCompare(ka)
    })
  }, [data, now])

  const prepareEnd = useMutation({
    mutationFn: async (session: Session) => ({ session, preview: await endPreview(category.id) }),
    onSuccess: setEnding,
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })
  const end = useMutation({
    mutationFn: () => endSession(category.id),
    onSuccess: () => {
      toast({ message: `Sesi ${ending?.session.label} diakhiri` })
      setEnding(null)
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (s: Session) => deleteSession(s.id),
    onSuccess: (_r, s) => {
      toast({ message: `Sesi ${s.label} dihapus` })
      setDeleting(null)
      refresh()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-bold">Jadwalkan sesi</p>
        <p className="mb-3 text-sm text-muted">
          Absen dibuka otomatis pada jam mulai dan ditutup otomatis setelah jam selesai + toleransi. Bisa satu sesi atau
          berulang (mis. setiap Senin & Kamis sebulan).
        </p>
        <Button onClick={() => setScheduling(true)} disabled={!data}>
          + Jadwalkan sesi
        </Button>
      </Card>

      <Card>
        <p className="mb-2 font-bold">Sesi</p>
        {isPending && <p className="text-muted">Memuat…</p>}
        <ErrorText>{error && errorMessage(error)}</ErrorText>
        {data && sessions.length === 0 && <p className="text-muted">Belum ada sesi. Jadwalkan sesi pertama.</p>}
        <ul className="divide-y divide-gray-100">
          {data &&
            sessions.map(({ s, state }) => {
              const recap = state === 'dijadwalkan' ? null : sessionRecap(data, s.id)
              const badge = STATE_BADGE[state]
              return (
                <li key={s.id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold break-words">
                        {s.label}{' '}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </p>
                      {s.start_time && (
                        <p className="text-sm">
                          {formatTimeRange(s.start_time, s.end_time)} WIB {formatGrace(s.grace_hours)}
                        </p>
                      )}
                      {s.note && <p className="break-words">{s.note}</p>}
                      <p className="text-sm text-muted">
                        {state === 'dijadwalkan'
                          ? `Dibuka ${formatDate(s.opens_at!)}`
                          : s.closed_at
                            ? `Ditutup ${formatDate(s.closed_at)}`
                            : s.closes_at
                              ? `Ditutup otomatis ${formatDate(s.closes_at)}`
                              : 'Berjalan sampai diakhiri manual'}
                      </p>
                    </div>
                    {recap && (
                      <span className="font-bold tabular-nums text-brand-700">
                        {recap.stats.all.percent}%{' '}
                        <span className="text-sm font-normal text-muted">
                          ({recap.stats.all.present}/{recap.stats.all.total})
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setEditing(s)}>
                      Ubah jadwal/catatan
                    </Button>
                    {state === 'dijadwalkan' && (
                      <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(s)}>
                        Hapus
                      </Button>
                    )}
                    {state === 'berjalan' && (
                      <Button variant="danger" onClick={() => prepareEnd.mutate(s)} disabled={prepareEnd.isPending}>
                        {prepareEnd.isPending ? 'Memeriksa…' : 'Akhiri sesi'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
        </ul>
      </Card>

      {ending && (
        <ConfirmDialog
          title={`Akhiri sesi ${ending.session.label}?`}
          message={
            <div className="flex flex-col gap-2">
              <p>
                Sesi ini berisi <b>{ending.preview.filled} catatan kehadiran</b> dan akan ditutup lebih cepat dari
                jadwalnya. Sesi lain yang sudah dijadwalkan tidak berubah.
              </p>
              {ending.preview.unfilled > 0 && (
                <p className="rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-200">
                  {ending.preview.autoStatus ? (
                    <>
                      <b>{ending.preview.unfilled} anggota yang belum mengisi</b> akan dicatat{' '}
                      <b>{ending.preview.autoStatus.label}</b>.
                    </>
                  ) : (
                    <>
                      <b>{ending.preview.unfilled} anggota yang belum mengisi</b> tetap tercatat "Belum" (status
                      otomatis: Tidak ada).
                    </>
                  )}
                </p>
              )}
            </div>
          }
          confirmLabel="Akhiri sesi"
          danger
          busy={end.isPending}
          error={end.error && errorMessage(end.error)}
          onConfirm={() => end.mutate()}
          onClose={() => {
            setEnding(null)
            end.reset()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus sesi ${deleting.label}?`}
          message="Sesi yang belum dimulai ini akan dihapus dan tidak akan dibuka."
          confirmLabel="Hapus sesi"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            setDeleting(null)
            remove.reset()
          }}
        />
      )}
      {scheduling && data && (
        <ScheduleSheet
          category={category}
          existing={data.sessions}
          onClose={() => setScheduling(false)}
          onDone={(n) => {
            setScheduling(false)
            refresh()
            toast({ message: `${n} sesi dijadwalkan` })
          }}
        />
      )}
      {editing && (
        <EditSessionSheet
          session={editing}
          finished={sessionState(editing, now) === 'selesai'}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ScheduleSheet({
  category,
  existing,
  onClose,
  onDone,
}: {
  category: Category
  existing: Session[]
  onClose: () => void
  onDone: (count: number) => void
}) {
  const today = todayJakarta()
  const [mode, setMode] = useState<'satu' | 'berulang'>('satu')
  const [times, setTimes] = useState<TimeFields>(DEFAULT_TIMES)
  const [date, setDate] = useState(today)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(presetRange('bulan-ini', today).to)
  // Tanggal biasa tercentang kecuali dilepas; duplikat tidak tercentang kecuali dicentang.
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [checkedDuplicates, setCheckedDuplicates] = useState<Set<string>>(new Set())

  const planned = useMemo(
    () => markDuplicates(recurringDates(weekdays, { from, to }), times.start, existing),
    [weekdays, from, to, times.start, existing],
  )
  const isChecked = (d: { date: string; duplicate: boolean }) =>
    d.duplicate ? checkedDuplicates.has(d.date) : !unchecked.has(d.date)
  const selected = mode === 'satu' ? [date] : planned.filter(isChecked).map((d) => d.date)
  const singleDuplicate = mode === 'satu' && markDuplicates([date], times.start, existing)[0].duplicate
  const tooMany = selected.length > MAX_SCHEDULE

  const save = useMutation({
    mutationFn: () =>
      scheduleSessions(
        category.id,
        selected.map((d) => ({ date: d, ...times })),
      ),
    onSuccess: onDone,
  })

  function toggle(d: { date: string; duplicate: boolean }) {
    const flip = (set: Set<string>) => {
      const next = new Set(set)
      if (next.has(d.date)) next.delete(d.date)
      else next.add(d.date)
      return next
    }
    if (d.duplicate) setCheckedDuplicates(flip)
    else setUnchecked(flip)
  }

  const canSave = timesValid(times) && selected.length > 0 && !tooMany && Boolean(date)

  return (
    <BottomSheet title="Jadwalkan sesi" subtitle={category.name} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-200/70 p-1" role="tablist">
          {(
            [
              ['satu', 'Satu sesi'],
              ['berulang', 'Berulang'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`min-h-11 rounded-xl px-2 font-medium ${mode === id ? 'bg-white shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'satu' ? (
          <Field label="Tanggal sesi" hint={date ? `Label: ${formatSessionDate(date)}` : undefined}>
            <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        ) : (
          <>
            <fieldset>
              <legend className="mb-1 font-medium">Hari</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((name, i) => {
                  const on = weekdays.includes(i)
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i) : [...w, i].sort()))}
                      className={`min-h-11 rounded-full px-3 font-medium ring-1 ${
                        on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-gray-300'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dari">
                <input
                  type="date"
                  className={inputClass}
                  value={from}
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                />
              </Field>
              <Field label="Sampai">
                <input
                  type="date"
                  className={inputClass}
                  value={to}
                  onChange={(e) => e.target.value && setTo(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        <SessionTimeFields value={times} onChange={setTimes} />

        {mode === 'berulang' && (
          <div>
            <p className="mb-1 font-medium">
              Pratinjau: {selected.length} sesi {weekdays.length === 0 && '(pilih hari dulu)'}
            </p>
            {planned.length > 0 && (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl p-1 ring-1 ring-gray-200">
                {planned.map((d) => (
                  <li key={d.date}>
                    <label
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-2 ${d.duplicate ? 'bg-yellow-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-brand-700"
                        checked={isChecked(d)}
                        onChange={() => toggle(d)}
                      />
                      <span className="min-w-0 flex-1">
                        {formatSessionDate(d.date)}
                        {d.duplicate && <span className="block text-sm text-yellow-800">Sudah ada sesi jam ini</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {tooMany && (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                Maksimal {MAX_SCHEDULE} sesi sekali jadwal ({formatDateShort(from)}–{formatDateShort(to)} menghasilkan{' '}
                {selected.length}). Persempit rentang tanggal.
              </p>
            )}
          </div>
        )}
        {singleDuplicate && (
          <p className="rounded-xl bg-yellow-50 p-3 text-sm ring-1 ring-yellow-200">
            Sudah ada sesi di tanggal ini dengan jam mulai yang sama. Tetap bisa disimpan bila memang disengaja.
          </p>
        )}

        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!canSave || save.isPending}>
          {save.isPending ? 'Menyimpan…' : `Jadwalkan ${selected.length} sesi`}
        </Button>
      </form>
    </BottomSheet>
  )
}

function EditSessionSheet({
  session,
  finished,
  onClose,
  onSaved,
}: {
  session: Session
  finished: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const legacy = !session.start_time
  const [date, setDate] = useState(session.session_date)
  const [times, setTimes] = useState<TimeFields>({
    start: session.start_time?.slice(0, 5) ?? '',
    end: session.end_time?.slice(0, 5) ?? '',
    grace: session.grace_hours,
    note: session.note ?? '',
  })
  // Sesi lama tanpa jam boleh tetap tanpa jam (kosongkan keduanya).
  const keepLegacy = legacy && !times.start && !times.end
  const save = useMutation({
    mutationFn: () =>
      updateSession(session.id, {
        date,
        start: finished ? session.start_time : keepLegacy ? null : times.start,
        end: finished ? session.end_time : keepLegacy ? null : times.end,
        grace: finished ? session.grace_hours : times.grace,
        note: times.note,
      }),
    onSuccess: onSaved,
  })
  const valid = Boolean(date) && (finished || keepLegacy || timesValid(times))
  return (
    <BottomSheet title="Ubah jadwal & catatan" subtitle={session.label} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Tanggal sesi" hint={date ? `Label: ${formatSessionDate(date)}` : undefined}>
          <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <SessionTimeFields value={times} onChange={setTimes} timesDisabled={finished} />
        <p className="text-sm text-muted">
          {finished
            ? 'Sesi sudah selesai: jam dan toleransi tidak bisa diubah. Mengubah tanggal memindahkan sesi ini ke laporan tanggal tersebut.'
            : session.opens_at
              ? `Saat ini dibuka ${jakartaTime(session.opens_at)} WIB. Mengubah tanggal/jam memindahkan jendela absen.`
              : 'Sesi lama tanpa jam: isi jam mulai & selesai agar ditutup otomatis, atau kosongkan keduanya.'}
        </p>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!valid || save.isPending}>
          Simpan
        </Button>
      </form>
    </BottomSheet>
  )
}
