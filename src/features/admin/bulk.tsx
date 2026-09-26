import { useMutation } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { membersWithHistory } from './api'

/** Kumpulan id terpilih; id yang tidak lagi ada di `existingIds` dibuang otomatis. */
export function useSelection(existingIds: readonly string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const key = existingIds.join(',')
  useEffect(() => {
    const existing = new Set(existingIds)
    setSelected((s) => {
      const next = new Set([...s].filter((id) => existing.has(id)))
      return next.size === s.size ? s : next
    })
  }, [key])

  return {
    selected,
    has: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    /** Pilih/lepas semua id hasil pencarian (semua halaman). */
    toggleAll: (visibleIds: readonly string[]) =>
      setSelected((s) => {
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => s.has(id))
        const next = new Set(s)
        for (const id of visibleIds) {
          if (allSelected) next.delete(id)
          else next.add(id)
        }
        return next
      }),
    clear: () => setSelected(new Set()),
  }
}

export function RowCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      className="h-6 w-6 shrink-0 accent-brand-700"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  )
}

/** Baris "Pilih semua" untuk seluruh hasil pencarian (semua halaman). */
export function SelectAllRow({
  visibleIds,
  selected,
  onToggle,
}: {
  visibleIds: readonly string[]
  selected: ReadonlySet<string>
  onToggle: () => void
}) {
  const count = visibleIds.filter((id) => selected.has(id)).length
  const all = visibleIds.length > 0 && count === visibleIds.length
  return (
    <label className="flex min-h-12 items-center gap-3 border-b border-gray-100 px-4 text-sm font-medium">
      <input
        type="checkbox"
        className="h-6 w-6 shrink-0 accent-brand-700"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = count > 0 && !all
        }}
        onChange={onToggle}
      />
      Pilih semua ({visibleIds.length} hasil)
    </label>
  )
}

/** Bilah aksi yang menempel di bawah layar selama ada yang dipilih. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <span className="mr-auto font-semibold">{count} dipilih</span>
        <button type="button" onClick={onClear} className="min-h-11 rounded-xl px-3 text-muted hover:bg-gray-100">
          Batal pilih
        </button>
        {children}
      </div>
    </div>
  )
}

/**
 * Konfirmasi hapus orang secara massal. Memeriksa riwayat dulu; bila ada yang
 * punya catatan kehadiran, admin harus mengetik HAPUS.
 */
export function BulkDeleteDialog({
  ids,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  ids: string[]
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const history = useMutation({ mutationFn: () => membersWithHistory(ids) })
  const run = history.mutate
  useEffect(() => run(), [run])

  if (history.isPending || history.isIdle) {
    return (
      <ConfirmDialog
        title={`Hapus ${ids.length} orang?`}
        message="Memeriksa riwayat kehadiran…"
        confirmLabel="Hapus orang"
        danger
        confirmDisabled
        onConfirm={() => {}}
        onClose={onClose}
      />
    )
  }
  const h = history.data ?? { people: 0, records: 0 }
  return (
    <ConfirmDialog
      title={`Hapus ${ids.length} orang?`}
      message={
        <div className="flex flex-col gap-2">
          <p>Orang terpilih akan dihapus permanen dari semua kategori.</p>
          {h.people > 0 && (
            <p className="rounded-xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200">
              <b>{h.people} orang</b> di antaranya punya <b>{h.records} catatan kehadiran</b> yang akan ikut terhapus
              dari laporan. Bila hanya ingin mengeluarkan dari satu kategori, gunakan "Keluarkan dari kategori".
            </p>
          )}
        </div>
      }
      typeToConfirm={h.people > 0 ? 'HAPUS' : undefined}
      confirmLabel={`Hapus ${ids.length} orang`}
      danger
      busy={busy}
      error={error ?? (history.error ? errorMessage(history.error) : null)}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
