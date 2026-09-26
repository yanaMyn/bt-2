import { Field, inputClass } from '../../components/ui'

export const NOTE_MAX = 200

export const GRACE_OPTIONS = [
  [0, 'Tanpa toleransi'],
  [6, '+6 jam'],
  [12, '+12 jam'],
  [24, '+24 jam'],
] as const

export interface TimeFields {
  start: string
  end: string
  grace: number
  note: string
}

/** Jam mulai–selesai (WIB), toleransi, dan catatan. `timesDisabled` untuk sesi yang sudah selesai. */
export function SessionTimeFields({
  value,
  onChange,
  timesDisabled = false,
}: {
  value: TimeFields
  onChange: (v: TimeFields) => void
  timesDisabled?: boolean
}) {
  const set = (patch: Partial<TimeFields>) => onChange({ ...value, ...patch })
  const invalid = value.start && value.end && value.end <= value.start
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jam mulai (WIB)">
          <input
            type="time"
            required
            disabled={timesDisabled}
            className={inputClass}
            value={value.start}
            onChange={(e) => set({ start: e.target.value })}
          />
        </Field>
        <Field label="Jam selesai">
          <input
            type="time"
            required
            disabled={timesDisabled}
            className={inputClass}
            value={value.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </Field>
      </div>
      {invalid && (
        <p role="alert" className="-mt-2 text-sm font-medium text-red-700">
          Jam selesai harus setelah jam mulai di hari yang sama.
        </p>
      )}
      <Field
        label="Toleransi setelah jam selesai"
        hint="Waktu tambahan bagi yang lupa absen. Setelah itu sesi selesai otomatis dan yang belum mengisi dicatat sesuai status otomatis."
      >
        <select
          className={inputClass}
          disabled={timesDisabled}
          value={value.grace}
          onChange={(e) => set({ grace: Number(e.target.value) })}
        >
          {GRACE_OPTIONS.map(([h, label]) => (
            <option key={h} value={h}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Catatan (opsional)"
        hint={`${value.note.length}/${NOTE_MAX} karakter, mis. tema kajian atau pemateri.`}
      >
        <textarea
          className={`${inputClass} min-h-20 py-2`}
          maxLength={NOTE_MAX}
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </Field>
    </>
  )
}

export const timesValid = (v: TimeFields) => Boolean(v.start && v.end && v.end > v.start)
