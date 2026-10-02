import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { StatusPill } from '../../components/StatusPill'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { STATUS_COLORS } from '../../lib/color'
import { errorMessage } from '../../lib/errors'
import type { Category, Status } from '../../lib/types'
import { createStatus, deleteStatus, getResetStatusId, listStatuses, setResetStatus, updateStatus } from './api'

function statusError(e: unknown) {
  return (e as { code?: string })?.code === '23505'
    ? 'Label sudah dipakai status lain di kegiatan ini.'
    : errorMessage(e)
}

export function CategoryStatusesTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['admin', 'statuses', category.id]
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: () => listStatuses(category.id) })
  const resetKey = ['admin', 'reset-status', category.id]
  const { data: resetStatusId } = useQuery({ queryKey: resetKey, queryFn: () => getResetStatusId(category.id) })
  const saveResetStatus = useMutation({
    mutationFn: (statusId: string | null) => setResetStatus(category.id, statusId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: resetKey })
      toast({ message: 'Status otomatis disimpan' })
    },
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })
  const [editing, setEditing] = useState<Status | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Status | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key })
    void qc.invalidateQueries({ queryKey: ['admin', 'reset-status', category.id] })
    void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'report', category.id] })
    void qc.invalidateQueries({ queryKey: ['kelompok-activities'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  const active = data?.filter((s) => !s.archived_at) ?? []
  const archived = data?.filter((s) => s.archived_at) ?? []

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const order = [...active]
      const [item] = order.splice(index, 1)
      order.splice(index + dir, 0, item)
      await Promise.all(
        order.map((s, i) => (s.sort_order === i + 1 ? null : updateStatus(s.id, { sort_order: i + 1 }))),
      )
    },
    onSettled: refresh,
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })

  const remove = useMutation({
    mutationFn: (s: Status) => deleteStatus(s.id),
    onSuccess: (result, s) => {
      setDeleting(null)
      refresh()
      toast({
        message: result === 'archived' ? `"${s.label}" diarsipkan karena sudah pernah dipakai` : `"${s.label}" dihapus`,
      })
    },
  })

  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Urutan di bawah = urutan tombol di layar orang tua.</p>
          <Button onClick={() => setEditing('new')} className="shrink-0">
            + Status
          </Button>
        </div>
        <ul className="divide-y divide-slate-100">
          {active.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <StatusPill status={s} />
                {s.counts_as_present && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    dihitung hadir
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  aria-label={`Naikkan ${s.label}`}
                  disabled={i === 0 || move.isPending}
                  onClick={() => move.mutate({ index: i, dir: -1 })}
                  className="w-11 px-0"
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  aria-label={`Turunkan ${s.label}`}
                  disabled={i === active.length - 1 || move.isPending}
                  onClick={() => move.mutate({ index: i, dir: 1 })}
                  className="w-11 px-0"
                >
                  ↓
                </Button>
                <Button variant="secondary" onClick={() => setEditing(s)}>
                  Ubah
                </Button>
                <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(s)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <label className="block">
          <span className="block font-bold">Status otomatis saat sesi diakhiri</span>
          <span className="mb-2 block text-sm text-muted">
            Anggota yang belum mengisi saat sesi diakhiri akan dicatat dengan status ini.
          </span>
          <select
            className={inputClass}
            value={resetStatusId ?? ''}
            disabled={resetStatusId === undefined || saveResetStatus.isPending}
            onChange={(e) => saveResetStatus.mutate(e.target.value || null)}
          >
            <option value="">Tidak ada (tetap "Belum")</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {archived.length > 0 && (
        <Card>
          <p className="font-bold">Status terarsip</p>
          <p className="mb-2 text-sm text-muted">Tidak muncul sebagai pilihan, tetapi tetap tampil di laporan lama.</p>
          <div className="flex flex-wrap gap-2 opacity-70">
            {archived.map((s) => (
              <StatusPill key={s.id} status={s} />
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <StatusForm
          category={category}
          status={editing === 'new' ? null : editing}
          nextOrder={(active.at(-1)?.sort_order ?? 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
            toast({ message: 'Status disimpan' })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus status "${deleting.label}"?`}
          message="Bila status ini sudah pernah dipakai, status akan diarsipkan agar laporan lama tetap utuh."
          confirmLabel="Hapus"
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
    </div>
  )
}

function StatusForm({
  category,
  status,
  nextOrder,
  onClose,
  onSaved,
}: {
  category: Category
  status: Status | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(status?.label ?? '')
  const [color, setColor] = useState(status?.color ?? STATUS_COLORS[0])
  const [present, setPresent] = useState(status?.counts_as_present ?? false)
  const save = useMutation({
    mutationFn: () =>
      status
        ? updateStatus(status.id, { label: label.trim(), color, counts_as_present: present })
        : createStatus({
            category_id: category.id,
            label: label.trim(),
            color,
            counts_as_present: present,
            sort_order: nextOrder,
          }),
    onSuccess: onSaved,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (label.trim()) save.mutate()
  }

  return (
    <BottomSheet title={status ? 'Ubah status' : 'Status baru'} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Label">
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="mis. Hadir"
          />
        </Field>
        <fieldset>
          <legend className="mb-1 font-medium">Warna</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Warna ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`h-11 w-11 rounded-full ${c === color ? 'ring-4 ring-slate-900 ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="h-6 w-6 accent-brand-700"
            checked={present}
            onChange={(e) => setPresent(e.target.checked)}
          />
          <span>
            <span className="font-medium">Dihitung hadir</span>
            <span className="block text-sm text-muted">Masuk hitungan persentase kehadiran.</span>
          </span>
        </label>
        <div>
          <p className="mb-1 text-sm text-muted">Pratinjau</p>
          <StatusPill
            status={{
              id: '',
              category_id: '',
              label: label || 'Label',
              color,
              sort_order: 0,
              counts_as_present: present,
              archived_at: null,
            }}
          />
        </div>
        <ErrorText>{save.error && statusError(save.error)}</ErrorText>
        <Button type="submit" disabled={!label.trim() || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
    </BottomSheet>
  )
}
