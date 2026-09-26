import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { sessionRecap } from '../../lib/reports'
import { formatSessionDate, todayJakarta } from '../../lib/sessionLabel'
import type { Category, Session } from '../../lib/types'
import { endPreview, endSession, loadReportData, startSession, updateSession, type EndPreview } from './api'
import { SessionDateFields } from './SessionDateFields'

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export function CategorySessionsTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const reportKey = ['admin', 'report', category.id]
  const { data, isPending, error } = useQuery({ queryKey: reportKey, queryFn: () => loadReportData(category.id) })
  const [ending, setEnding] = useState<{ session: Session; preview: EndPreview } | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)

  const active = data?.sessions.find((s) => !s.closed_at) ?? null

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-bold">Buat sesi baru</p>
        <p className="mb-3 text-sm text-muted">
          Memulai sesi baru dengan tanggal dari kalender. Semua anggota mulai dari "Belum".
        </p>
        <Button onClick={() => setCreating(true)} disabled={!data || Boolean(active)}>
          + Buat sesi baru
        </Button>
        {active && (
          <p className="mt-2 text-sm text-muted">
            Akhiri sesi aktif dulu (<b>{active.label}</b>) sebelum membuat sesi baru.
          </p>
        )}
      </Card>

      <Card>
        <p className="mb-2 font-bold">Riwayat sesi</p>
        {isPending && <p className="text-muted">Memuat…</p>}
        <ErrorText>{error && errorMessage(error)}</ErrorText>
        {data && data.sessions.length === 0 && <p className="text-muted">Belum ada sesi.</p>}
        <ul className="divide-y divide-gray-100">
          {data?.sessions.map((s) => {
            const recap = sessionRecap(data, s.id)
            return (
              <li key={s.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">
                      {s.label}{' '}
                      {!s.closed_at && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                          berjalan
                        </span>
                      )}
                    </p>
                    {s.note && <p className="break-words">{s.note}</p>}
                    <p className="text-sm text-muted">
                      Dibuka {formatDate(s.started_at)} ·{' '}
                      {s.closed_at ? `diakhiri ${formatDate(s.closed_at)}` : 'masih berjalan'}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums text-brand-700">
                    {recap.stats.all.percent}%{' '}
                    <span className="text-sm font-normal text-muted">
                      ({recap.stats.all.present}/{recap.stats.all.total})
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditing(s)}>
                    Ubah tanggal/catatan
                  </Button>
                  {!s.closed_at && (
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
                Sesi ini berisi <b>{ending.preview.filled} catatan kehadiran</b> dan akan ditutup untuk laporan. Orang
                tua tidak bisa mengisi <b>{category.name}</b> sampai Anda membuat sesi baru. Kategori lain tidak
                terpengaruh.
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
      {creating && (
        <CreateSessionSheet
          category={category}
          onClose={() => setCreating(false)}
          onCreated={(label) => {
            setCreating(false)
            refresh()
            toast({ message: `Sesi baru dibuat: ${label}` })
          }}
        />
      )}
      {editing && (
        <EditSessionSheet
          session={editing}
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

function CreateSessionSheet({
  category,
  onClose,
  onCreated,
}: {
  category: Category
  onClose: () => void
  onCreated: (label: string) => void
}) {
  const [date, setDate] = useState(todayJakarta())
  const [note, setNote] = useState('')
  const save = useMutation({
    mutationFn: () => startSession(category.id, date, note),
    onSuccess: () => onCreated(formatSessionDate(date)),
  })
  return (
    <BottomSheet title="Buat sesi baru" subtitle={category.name} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (date) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <SessionDateFields date={date} note={note} onDate={setDate} onNote={setNote} />
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!date || save.isPending}>
          {save.isPending ? 'Membuat…' : 'Buat sesi'}
        </Button>
      </form>
    </BottomSheet>
  )
}

function EditSessionSheet({
  session,
  onClose,
  onSaved,
}: {
  session: Session
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(session.session_date)
  const [note, setNote] = useState(session.note ?? '')
  const save = useMutation({ mutationFn: () => updateSession(session.id, date, note), onSuccess: onSaved })
  return (
    <BottomSheet title="Ubah tanggal & catatan sesi" subtitle={session.label} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (date) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <SessionDateFields date={date} note={note} onDate={setDate} onNote={setNote} />
        <p className="text-sm text-muted">Mengubah tanggal juga memindahkan sesi ini ke laporan tanggal tersebut.</p>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!date || save.isPending}>
          Simpan
        </Button>
      </form>
    </BottomSheet>
  )
}
