import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { Button, Card, ErrorText, PageHeader } from '../../components/ui'
import { MARITAL_LABEL } from '../../lib/criteria'
import { formatDateShort } from '../../lib/dateRange'
import { errorMessage } from '../../lib/errors'
import {
  classifyImportRows,
  downloadTemplate,
  ImportFormatError,
  isXlsxFile,
  parseWorkbook,
  type ClassifiedRow,
} from '../../lib/importXlsx'
import { todayJakarta } from '../../lib/sessionLabel'
import { importJamaah, listJamaah } from './api'
import { useProfile } from './profile'

const KIND_STYLE: Record<ClassifiedRow['kind'], { box: string; label: string }> = {
  valid: { box: 'bg-green-50 ring-green-200', label: 'Baru' },
  duplicate: { box: 'bg-yellow-50 ring-yellow-300', label: 'Duplikat' },
  invalid: { box: 'bg-red-50 ring-red-200', label: 'Tidak valid' },
}

/** Import jamaah ke kelompok admin yang sedang login (hanya admin Kelompok). */
export function ImportPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const { data: jamaah } = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ClassifiedRow[] | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [fileError, setFileError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  if (profile.unit_level !== 'kelompok') {
    return <p className="text-muted">Import jamaah hanya untuk admin Kelompok.</p>
  }

  function clear() {
    setRows(null)
    setChecked(new Set())
    setFileName(null)
    setFileError(null)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    clear()
    setDone(null)
    if (!isXlsxFile(file.name)) {
      setFileError('Hanya file .xlsx yang diterima. Gunakan template yang disediakan.')
      return
    }
    setReading(true)
    try {
      const parsed = parseWorkbook(await file.arrayBuffer())
      const existing = (jamaah ?? []).filter((m) => m.kelompok_id === profile.unit_id && !m.inactive_since)
      const classified = classifyImportRows(parsed, existing, todayJakarta())
      setRows(classified)
      setChecked(new Set(classified.filter((r) => r.kind === 'valid').map((r) => r.rowNumber)))
      setFileName(file.name)
    } catch (err) {
      setFileError(err instanceof ImportFormatError ? err.message : errorMessage(err))
    } finally {
      setReading(false)
    }
  }

  const save = useMutation({
    mutationFn: () =>
      importJamaah(
        rows!
          .filter((r) => checked.has(r.rowNumber) && r.gender && r.marital)
          .map((r) => ({ name: r.name, gender: r.gender!, birth_date: r.birth_date, marital_status: r.marital! })),
      ),
    onSuccess: (count) => {
      setDone(`${count} jamaah ditambahkan ke Kelompok ${profile.unit_name}`)
      clear()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const counts = rows && {
    valid: rows.filter((r) => r.kind === 'valid').length,
    duplicate: rows.filter((r) => r.kind === 'duplicate').length,
    invalid: rows.filter((r) => r.kind === 'invalid').length,
    incomplete: rows.filter((r) => r.kind !== 'invalid' && r.incomplete).length,
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ to: '/admin/jamaah', label: 'Jamaah' }}
        title="Import jamaah"
        description={
          <>
            Semua baris dari file <b>.xlsx</b> masuk ke Kelompok <b>{profile.unit_name}</b> sebagai jamaah baru.
          </>
        }
      />

      <Card className="flex flex-col gap-4">
        <div>
          <p className="mb-1 font-medium">1. Siapkan file</p>
          <p className="mb-2 text-sm text-muted">
            Kolom wajib: <b>Nama</b> dan <b>Jenis Kelamin</b>. Opsional: <b>Tanggal Lahir</b> (DD/MM/YYYY) dan{' '}
            <b>Status Nikah</b> (Belum, Menikah, Janda, Duda). Tanpa tanggal lahir, jamaah tidak masuk kegiatan berbatas
            umur.
          </p>
          <Button variant="secondary" onClick={downloadTemplate}>
            ⬇ Unduh template
          </Button>
        </div>
        <div>
          <p className="mb-1 font-medium">2. Unggah file</p>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={reading || !jamaah}
            onChange={onFile}
            className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-700 file:px-4 file:font-semibold file:text-white disabled:opacity-50"
          />
          {reading && <p className="mt-1 text-muted">Membaca file…</p>}
          <ErrorText>{fileError}</ErrorText>
        </div>
      </Card>

      {done && (
        <p role="status" className="rounded-2xl bg-green-50 p-4 font-semibold text-green-800 ring-1 ring-green-200">
          ✓ {done}
        </p>
      )}

      {rows && counts && (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="font-bold">Pratinjau: {fileName}</p>
            <p className="text-sm text-muted">
              {counts.valid} baru · {counts.duplicate} duplikat (tidak dicentang, bisa dicentang bila memang orang
              berbeda) · {counts.invalid} tidak valid (dilewati) · {counts.incomplete} tanpa tanggal lahir
            </p>
          </div>
          {rows.length === 0 && <p className="text-muted">File tidak berisi data.</p>}
          <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
            {rows.map((r) => {
              const style = KIND_STYLE[r.kind]
              const disabled = r.kind === 'invalid'
              return (
                <li key={r.rowNumber}>
                  <label
                    className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${style.box} ${disabled ? 'opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="h-6 w-6 shrink-0 accent-brand-700"
                      disabled={disabled}
                      checked={checked.has(r.rowNumber)}
                      onChange={(e) =>
                        setChecked((s) => {
                          const next = new Set(s)
                          if (e.target.checked) next.add(r.rowNumber)
                          else next.delete(r.rowNumber)
                          return next
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words">
                        {r.name || <i className="text-muted">(tanpa nama)</i>}{' '}
                        <span className="text-muted">({r.gender ?? (r.rawGender.trim() || '?')})</span>
                      </span>
                      <span className="block text-sm text-muted">
                        {r.birth_date ? `Lahir ${formatDateShort(r.birth_date)}` : 'Tanggal lahir kosong'}
                        {r.marital ? ` · ${MARITAL_LABEL[r.marital]}` : ''}
                      </span>
                      <span className="text-sm text-muted">
                        Baris {r.rowNumber} · {style.label}
                        {r.reason ? ` — ${r.reason}` : ''}
                        {r.kind !== 'invalid' && r.incomplete ? ' · data belum lengkap' : ''}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={clear} disabled={save.isPending}>
              Batal
            </Button>
            <Button onClick={() => save.mutate()} disabled={checked.size === 0 || save.isPending}>
              {save.isPending ? 'Menyimpan…' : `Import ${checked.size} jamaah`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
