import { Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass, PageHeader } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import { errorMessage } from '../../lib/errors'
import type { OrgUnit } from '../../lib/types'
import { createUnit, deleteUnit, renameUnit } from './api'
import { useProfile } from './profile'
import { useUnits } from './units'

type Editing = { mode: 'create'; parent: OrgUnit } | { mode: 'rename'; unit: OrgUnit }

/** Daerah: kelola Desa & Kelompok. Desa: kelola Kelompok di desanya. */
export function StructurePage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: units = [], isPending, error } = useUnits()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<OrgUnit | null>(null)

  const remove = useMutation({
    mutationFn: (u: OrgUnit) => deleteUnit(u.id),
    onSuccess: (_r, u) => {
      setDeleting(null)
      void qc.invalidateQueries({ queryKey: ['admin'] })
      toast({ message: `${u.level === 'desa' ? 'Desa' : 'Kelompok'} ${u.name} dihapus` })
    },
  })

  if (profile.unit_level === 'kelompok') return <p className="text-muted">Struktur dikelola admin Desa dan Daerah.</p>
  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>

  const me = units.find((u) => u.id === profile.unit_id)
  if (!me) return <ErrorText>Unit Anda tidak ditemukan.</ErrorText>
  const desaList = profile.unit_level === 'daerah' ? childrenOf(units, me.id) : [me]

  const unitRow = (u: OrgUnit, canDelete: boolean) => (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" onClick={() => setEditing({ mode: 'rename', unit: u })}>
        Ubah nama
      </Button>
      {canDelete && (
        <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(u)}>
          Hapus
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Kelola"
        title="Struktur"
        description={
          profile.unit_level === 'daerah' ? `Daerah ${me.name}: Desa dan Kelompok.` : `Kelompok di Desa ${me.name}.`
        }
        actions={
          profile.unit_level === 'daerah' && (
            <Button onClick={() => setEditing({ mode: 'create', parent: me })}>
              <Plus className="size-5" aria-hidden /> Desa
            </Button>
          )
        }
      />

      {profile.unit_level === 'daerah' && (
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="text-sm text-muted">Daerah</span>
            <span className="block font-bold">{me.name}</span>
          </span>
          {unitRow(me, false)}
        </Card>
      )}

      {desaList.length === 0 && <p className="text-muted">Belum ada Desa. Tambahkan Desa pertama.</p>}
      {desaList.map((desa) => {
        const kelompok = childrenOf(units, desa.id)
        return (
          <Card key={desa.id} className="flex flex-col gap-2 p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 pt-3 pb-2">
              <span>
                <span className="text-sm text-muted">Desa</span>
                <span className="block font-bold">{desa.name}</span>
              </span>
              {profile.unit_level === 'daerah' && unitRow(desa, true)}
            </div>
            <ul className="divide-y divide-slate-100">
              {kelompok.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
                  <span>Kelompok {k.name}</span>
                  {unitRow(k, true)}
                </li>
              ))}
              {kelompok.length === 0 && <li className="px-4 py-2 text-muted">Belum ada kelompok.</li>}
            </ul>
            <div className="px-4 pb-3">
              <Button variant="secondary" onClick={() => setEditing({ mode: 'create', parent: desa })}>
                + Kelompok
              </Button>
            </div>
          </Card>
        )
      })}

      {editing && (
        <UnitNameSheet
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            void qc.invalidateQueries({ queryKey: ['admin'] })
            toast({ message: msg })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus ${deleting.level === 'desa' ? 'Desa' : 'Kelompok'} ${deleting.name}?`}
          message="Hanya unit kosong yang bisa dihapus: tanpa kelompok, jamaah, kegiatan, dan akun admin."
          confirmLabel="Hapus"
          danger
          busy={remove.isPending}
          error={remove.error && unitDeleteError(remove.error)}
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

const LEFT_LABEL: Record<string, string> = {
  kelompok: 'kelompok',
  jamaah: 'jamaah',
  kegiatan: 'kegiatan',
  admin: 'akun admin',
}

/** UNIT_NOT_EMPTY membawa detail isi yang tersisa, mis. "kelompok,jamaah". */
function unitDeleteError(e: unknown): string {
  const err = e as { message?: string; details?: string }
  if (err.message === 'UNIT_NOT_EMPTY' && err.details) {
    const parts = err.details
      .replace(/[{}]/g, '')
      .split(',')
      .map((s) => LEFT_LABEL[s.trim()] ?? s.trim())
    return `Masih ada ${parts.join(', ')} di dalamnya. Pindahkan atau hapus dulu.`
  }
  return errorMessage(e)
}

function UnitNameSheet({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const creating = editing.mode === 'create'
  const noun = creating ? (editing.parent.level === 'daerah' ? 'Desa' : 'Kelompok') : LEVEL_NOUN[editing.unit.level]
  const [name, setName] = useState(creating ? '' : editing.unit.name)
  const save = useMutation({
    mutationFn: () =>
      (creating ? createUnit(editing.parent.id, name) : renameUnit(editing.unit.id, name)).then(() => {}),
    onSuccess: () => onSaved(creating ? `${noun} ${name.trim()} ditambahkan` : `Nama diubah menjadi ${name.trim()}`),
  })
  return (
    <BottomSheet
      title={creating ? `${noun} baru` : `Ubah nama ${noun}`}
      subtitle={creating && editing.parent.level === 'desa' ? `Di Desa ${editing.parent.name}` : undefined}
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) save.mutate()
        }}
      >
        <Field label={`Nama ${noun}`}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </Field>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
    </BottomSheet>
  )
}

const LEVEL_NOUN: Record<OrgUnit['level'], string> = { daerah: 'Daerah', desa: 'Desa', kelompok: 'Kelompok' }
