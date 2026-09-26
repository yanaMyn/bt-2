import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { criteriaText } from '../../lib/criteria'
import { errorMessage } from '../../lib/errors'
import type { CriteriaMarital, Gender } from '../../lib/types'
import { deleteTemplate, listTemplates, saveTemplate, type CriteriaTemplate } from './api'
import { useProfile } from './profile'

const toNum = (v: string) => (v.trim() === '' ? null : Number(v))

const asCriteria = (t: CriteriaTemplate) => ({
  criteria_gender: t.gender,
  criteria_min_age: t.min_age,
  criteria_max_age: t.max_age,
  criteria_marital: t.marital,
})

/** Templat kriteria peserta (hanya Admin Daerah). Mengubah templat tidak mengubah kegiatan yang sudah dibuat. */
export function TemplatesPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const toast = useToast()
  const { data = [], isPending, error } = useQuery({ queryKey: ['admin', 'templates'], queryFn: listTemplates })
  const [editing, setEditing] = useState<CriteriaTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CriteriaTemplate | null>(null)
  const remove = useMutation({
    mutationFn: (t: CriteriaTemplate) => deleteTemplate(t.id),
    onSuccess: (_r, t) => {
      setDeleting(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'templates'] })
      toast({ message: `Templat ${t.name} dihapus` })
    },
  })

  if (profile.unit_level !== 'daerah') return <p className="text-muted">Templat dikelola Admin Daerah.</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Templat kegiatan</h1>
          <p className="text-muted">
            Pilihan cepat saat admin membuat kegiatan. Mengubah templat tidak mengubah kegiatan yang sudah ada.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>+ Templat</Button>
      </div>
      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      <Card className="p-0">
        <ul className="divide-y divide-gray-100">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.name}</span>
                <span className="text-sm text-muted">{criteriaText(asCriteria(t))}</span>
              </span>
              <Button variant="ghost" onClick={() => setEditing(t)}>
                Ubah
              </Button>
              <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(t)}>
                Hapus
              </Button>
            </li>
          ))}
          {!isPending && data.length === 0 && <li className="p-4 text-muted">Belum ada templat.</li>}
        </ul>
      </Card>

      {editing && (
        <TemplateSheet
          template={editing === 'new' ? null : editing}
          nextOrder={Math.max(0, ...data.map((t) => t.sort_order)) + 1}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            void qc.invalidateQueries({ queryKey: ['admin', 'templates'] })
            toast({ message: `Templat ${name} disimpan` })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus templat ${deleting.name}?`}
          message="Kegiatan yang dibuat dari templat ini tidak terpengaruh."
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

function TemplateSheet({
  template,
  nextOrder,
  onClose,
  onSaved,
}: {
  template: CriteriaTemplate | null
  nextOrder: number
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [gender, setGender] = useState<Gender | ''>(template?.gender ?? '')
  const [minAge, setMinAge] = useState(template?.min_age?.toString() ?? '')
  const [maxAge, setMaxAge] = useState(template?.max_age?.toString() ?? '')
  const [marital, setMarital] = useState<CriteriaMarital | ''>(template?.marital ?? '')
  const [order, setOrder] = useState(String(template?.sort_order ?? nextOrder))
  const min = toNum(minAge)
  const max = toNum(maxAge)
  const ageError =
    (min !== null && (!Number.isInteger(min) || min < 0 || min > 120)) ||
    (max !== null && (!Number.isInteger(max) || max < 0 || max > 120)) ||
    (min !== null && max !== null && min > max)
  const save = useMutation({
    mutationFn: () =>
      saveTemplate({
        id: template?.id,
        name: name.trim(),
        gender: gender || null,
        min_age: min,
        max_age: max,
        marital: marital || null,
        sort_order: Number(order) || 0,
      }),
    onSuccess: () => onSaved(name.trim()),
  })
  return (
    <BottomSheet title={template ? 'Ubah templat' : 'Templat baru'} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() && !ageError) save.mutate()
        }}
      >
        <Field label="Nama">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Jenis kelamin">
          <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
            <option value="">Semua</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Umur minimal">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              className={inputClass}
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />
          </Field>
          <Field label="Umur maksimal">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              className={inputClass}
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
            />
          </Field>
        </div>
        {ageError && <ErrorText>Rentang umur tidak valid (0–120, minimal ≤ maksimal).</ErrorText>}
        <Field label="Status nikah">
          <select
            className={inputClass}
            value={marital}
            onChange={(e) => setMarital(e.target.value as CriteriaMarital | '')}
          >
            <option value="">Semua</option>
            <option value="belum">Belum menikah</option>
            <option value="pernah">Pernah menikah (termasuk janda/duda)</option>
          </select>
        </Field>
        <Field label="Urutan tampil">
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </Field>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!name.trim() || ageError || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
    </BottomSheet>
  )
}
