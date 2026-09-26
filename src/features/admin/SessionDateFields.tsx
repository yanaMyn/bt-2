import { Field, inputClass } from '../../components/ui'
import { formatSessionDate } from '../../lib/sessionLabel'

export const NOTE_MAX = 200

/** Kalender tanggal sesi + catatan opsional, dengan pratinjau label yang akan dibentuk. */
export function SessionDateFields({
  date,
  note,
  onDate,
  onNote,
}: {
  date: string
  note: string
  onDate: (date: string) => void
  onNote: (note: string) => void
}) {
  return (
    <>
      <Field label="Tanggal Sesi Baru Berikutnya" hint={date ? `Label: ${formatSessionDate(date)}` : 'Pilih tanggal dari kalender.'}>
        <input type="date" required className={inputClass} value={date} onChange={(e) => onDate(e.target.value)} />
      </Field>
      <Field label="Catatan (opsional)" hint={`${note.length}/${NOTE_MAX} karakter, mis. tema kajian atau pemateri.`}>
        <textarea
          className={`${inputClass} min-h-20 py-2`}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </Field>
    </>
  )
}
