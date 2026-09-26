import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { sessionRecap } from '../../lib/reports'
import { formatSessionDate, todayJakarta } from '../../lib/sessionLabel'
import type { Category, Session } from '../../lib/types'
import { activeSessionAttendanceCount, loadReportData, resetCategory, updateSession } from './api'
import { SessionDateFields } from './SessionDateFields'

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export function CategorySessionsTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const reportKey = ['admin', 'report', category.id]
  const { data, isPending, error } = useQuery({ queryKey: reportKey, queryFn: () => loadReportData(category.id) })
  const [resetting, setResetting] = useState<{ count: number } | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<Session | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  const prepare = useMutation({
    mutationFn: () => activeSessionAttendanceCount(category.id),
    onSuccess: (count) => {
      setDate(todayJakarta())
      setNote('')
      setResetting({ count })
    },
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })
  const reset = useMutation({
    mutationFn: () => resetCategory(category.id, date, note),
    onSuccess: () => {
      setResetting(null)
      refresh()
      toast({ message: `Kehadiran ${category.name} di-reset. Sesi baru: ${formatSessionDate(date)}` })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-bold">Reset kehadiran</p>
        <p className="mb-3 text-sm text-muted">
          Menutup sesi saat ini dan memulai sesi baru. Semua anggota kembali "Belum". Riwayat sesi lama tetap tersimpan
          untuk laporan.
        </p>
        <Button variant="danger" onClick={() => prepare.mutate()} disabled={prepare.isPending}>
          {prepare.isPending ? 'Memeriksa…' : 'Reset kehadiran…'}
        </Button>
      </Card>

      <Card>
        <p className="mb-2 font-bold">Riwayat sesi</p>
        {isPending && <p className="text-muted">Memuat…</p>}
        <ErrorText>{error && errorMessage(error)}</ErrorText>
        <ul className="divide-y divide-gray-100">
          {data?.sessions.map((s) => {
            const recap = sessionRecap(data, s.id)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">
                    {s.label}{' '}
                    {!s.closed_at && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                        aktif
                      </span>
                    )}
                  </p>
                  {s.note && <p className="break-words">{s.note}</p>}
                  <p className="text-sm text-muted">
                    Dibuka {formatDate(s.started_at)} ·{' '}
                    {s.closed_at ? `ditutup ${formatDate(s.closed_at)}` : 'masih berjalan'}
                  </p>
                </div>
                <span className="font-bold tabular-nums text-brand-700">
                  {recap.stats.all.percent}%{' '}
                  <span className="text-sm font-normal text-muted">
                    ({recap.stats.all.present}/{recap.stats.all.total})
                  </span>
                </span>
                <Button variant="secondary" onClick={() => setEditing(s)}>
                  Ubah tanggal/catatan
                </Button>
              </li>
            )
          })}
        </ul>
      </Card>

      {resetting && (
        <ConfirmDialog
          title={`Reset kehadiran ${category.name}?`}
          message={
            <>
              Sesi saat ini berisi <b>{resetting.count} catatan kehadiran</b>. Sesi akan ditutup dan diarsipkan untuk
              laporan, lalu semua anggota <b>{category.name}</b> kembali "Belum". Kategori lain tidak terpengaruh.
            </>
          }
          confirmLabel="Reset sekarang"
          danger
          busy={reset.isPending}
          confirmDisabled={!date}
          error={reset.error && errorMessage(reset.error)}
          onConfirm={() => reset.mutate()}
          onClose={() => {
            setResetting(null)
            reset.reset()
          }}
        >
          <SessionDateFields date={date} note={note} onDate={setDate} onNote={setNote} />
        </ConfirmDialog>
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
        <p className="text-sm text-muted">
          Mengubah tanggal juga memindahkan sesi ini ke rekap bulan tanggal tersebut.
        </p>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!date || save.isPending}>
          Simpan
        </Button>
      </form>
    </BottomSheet>
  )
}
