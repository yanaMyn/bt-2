import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, inputClass } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import type { CriteriaMarital, Gender, OrgUnit, UnitLevel } from '../../lib/types'
import type { ActivityInput, CriteriaTemplate } from './api'

const toNum = (v: string) => (v.trim() === '' ? null : Number(v))

/**
 * Formulir kegiatan: nama, kriteria peserta, dan wilayah (untuk kegiatan Desa/Daerah).
 * `templates` hanya ditampilkan saat membuat kegiatan baru.
 */
export function ActivityForm({
  initial,
  ownerLevel,
  ownerUnitId,
  units,
  templates,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  initial: ActivityInput
  ownerLevel: UnitLevel
  ownerUnitId: string
  units: OrgUnit[]
  templates?: CriteriaTemplate[]
  submitLabel: string
  busy: boolean
  error: string | null
  onSubmit: (input: ActivityInput) => void
}) {
  const [name, setName] = useState(initial.name)
  const [gender, setGender] = useState<Gender | ''>(initial.gender ?? '')
  const [minAge, setMinAge] = useState(initial.minAge?.toString() ?? '')
  const [maxAge, setMaxAge] = useState(initial.maxAge?.toString() ?? '')
  const [marital, setMarital] = useState<CriteriaMarital | ''>(initial.marital ?? '')
  const [scopeAll, setScopeAll] = useState(initial.scopeAll)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.units))
  const [localError, setLocalError] = useState<string | null>(null)

  const children = childrenOf(units, ownerUnitId)
  const childNoun = ownerLevel === 'desa' ? 'kelompok' : 'desa'

  function applyTemplate(id: string) {
    const t = templates?.find((x) => x.id === id)
    if (!t) return
    setName(t.name)
    setGender(t.gender ?? '')
    setMinAge(t.min_age?.toString() ?? '')
    setMaxAge(t.max_age?.toString() ?? '')
    setMarital(t.marital ?? '')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    const min = toNum(minAge)
    const max = toNum(maxAge)
    if (
      (min !== null && (!Number.isInteger(min) || min < 0 || min > 120)) ||
      (max !== null && (!Number.isInteger(max) || max < 0 || max > 120)) ||
      (min !== null && max !== null && min > max)
    ) {
      return setLocalError('Rentang umur tidak valid (0–120, minimal ≤ maksimal).')
    }
    if (ownerLevel !== 'kelompok' && !scopeAll && selected.size === 0) {
      return setLocalError(`Pilih minimal satu ${childNoun}.`)
    }
    onSubmit({
      name,
      gender: gender || null,
      minAge: min,
      maxAge: max,
      marital: marital || null,
      scopeAll: ownerLevel === 'kelompok' ? true : scopeAll,
      units: [...selected],
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {templates && templates.length > 0 && (
        <Field label="Mulai dari templat (opsional)" hint="Mengisi nama & kriteria; masih bisa diubah.">
          <select className={inputClass} defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Kegiatan kustom —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Nama kegiatan">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3">
        <legend className="px-1 font-medium">Kriteria peserta</legend>
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
              className={inputClass}
              inputMode="numeric"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value.replace(/\D/g, ''))}
              placeholder="–"
            />
          </Field>
          <Field label="Umur maksimal">
            <input
              className={inputClass}
              inputMode="numeric"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value.replace(/\D/g, ''))}
              placeholder="–"
            />
          </Field>
        </div>
        <p className="-mt-2 text-sm text-muted">
          Umur dihitung pada tanggal sesi. Jamaah tanpa tanggal lahir tidak masuk kegiatan berbatas umur.
        </p>
        <Field label="Status nikah">
          <select
            className={inputClass}
            value={marital}
            onChange={(e) => setMarital(e.target.value as CriteriaMarital | '')}
          >
            <option value="">Semua</option>
            <option value="belum">Belum menikah</option>
            <option value="pernah">Pernah menikah (menikah / janda / duda)</option>
          </select>
        </Field>
      </fieldset>

      {ownerLevel !== 'kelompok' && (
        <fieldset className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
          <legend className="px-1 font-medium">Wilayah peserta</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              className="h-5 w-5 accent-brand-700"
              checked={scopeAll}
              onChange={() => setScopeAll(true)}
            />
            Semua {childNoun} (termasuk yang ditambahkan nanti)
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              className="h-5 w-5 accent-brand-700"
              checked={!scopeAll}
              onChange={() => setScopeAll(false)}
            />
            Pilih {childNoun}
          </label>
          {!scopeAll && (
            <div className="flex flex-col gap-1 pl-8">
              {children.length === 0 && <p className="text-sm text-muted">Belum ada {childNoun}.</p>}
              {children.map((u) => (
                <label key={u.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-700"
                    checked={selected.has(u.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s)
                        if (n.has(u.id)) n.delete(u.id)
                        else n.add(u.id)
                        return n
                      })
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <ErrorText>{localError ?? error}</ErrorText>
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? 'Menyimpan…' : submitLabel}
      </Button>
    </form>
  )
}

export const EMPTY_ACTIVITY: ActivityInput = {
  name: '',
  gender: null,
  minAge: null,
  maxAge: null,
  marital: null,
  scopeAll: true,
  units: [],
}
