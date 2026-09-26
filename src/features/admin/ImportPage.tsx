import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Card, ErrorText, Field, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import {
  classifyImportRows,
  downloadTemplate,
  ImportFormatError,
  isXlsxFile,
  parseWorkbook,
  type ClassifiedRow,
} from '../../lib/importXlsx'
import { importMembers, listCategories, listCategoryMembers } from './api'

const KIND_STYLE: Record<ClassifiedRow['kind'], { box: string; label: string }> = {
  valid: { box: 'bg-green-50 ring-green-200', label: 'Baru' },
  duplicate: { box: 'bg-yellow-50 ring-yellow-300', label: 'Duplikat' },
  invalid: { box: 'bg-red-50 ring-red-200', label: 'Tidak valid' },
}

export function ImportPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const categoryId = params.get('kategori') ?? ''
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const category = categories?.find((c) => c.id === categoryId)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ClassifiedRow[] | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [fileError, setFileError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  function clear() {
    setRows(null)
    setChecked(new Set())
    setFileName(null)
    setFileError(null)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !categoryId) return
    clear()
    setDone(null)
    if (!isXlsxFile(file.name)) {
      setFileError('Hanya file .xlsx yang diterima. Gunakan template yang disediakan.')
      return
    }
    setReading(true)
    try {
      const parsed = parseWorkbook(await file.arrayBuffer())
      const existing = await listCategoryMembers(categoryId)
      const classified = classifyImportRows(parsed, existing)
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
      importMembers(
        categoryId,
        rows!.filter((r) => checked.has(r.rowNumber) && r.gender).map((r) => ({ name: r.name, gender: r.gender! })),
      ),
    onSuccess: (count) => {
      setDone(`${count} anggota ditambahkan ke ${category?.name}`)
      clear()
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['summaries'] })
      void qc.invalidateQueries({ queryKey: ['category'] })
    },
  })

  const counts = rows && {
    valid: rows.filter((r) => r.kind === 'valid').length,
    duplicate: rows.filter((r) => r.kind === 'duplicate').length,
    invalid: rows.filter((r) => r.kind === 'invalid').length,
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Import anggota (.xlsx)</h1>
        <p className="text-muted">Satu file untuk satu kategori. Setiap baris selalu dibuat sebagai orang baru.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <Field label="1. Pilih kategori tujuan">
          <select
            className={inputClass}
            value={categoryId}
            onChange={(e) => {
              setParams(e.target.value ? { kategori: e.target.value } : {}, { replace: true })
              clear()
              setDone(null)
            }}
          >
            <option value="">— Pilih kategori —</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <p className="mb-1 font-medium">2. Siapkan file</p>
          <p className="mb-2 text-sm text-muted">
            Kolom wajib: <b>Nama</b> dan <b>Jenis Kelamin</b> (L/P, Laki-laki, Perempuan).
          </p>
          <Button variant="secondary" onClick={downloadTemplate}>
            ⬇ Unduh template
          </Button>
        </div>

        <div>
          <p className="mb-1 font-medium">3. Unggah file</p>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!categoryId || reading}
            onChange={onFile}
            className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-700 file:px-4 file:font-semibold file:text-white disabled:opacity-50"
          />
          {!categoryId && <p className="mt-1 text-sm text-muted">Pilih kategori terlebih dahulu.</p>}
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
              berbeda) · {counts.invalid} tidak valid (dilewati)
            </p>
          </div>
          {rows.length === 0 && <p className="text-muted">File tidak berisi data.</p>}
          <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
            {rows.map((r) => {
              const style = KIND_STYLE[r.kind]
              const disabled = r.kind === 'invalid'
              return (
                <li key={r.rowNumber}>
                  <label className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${style.box} ${disabled ? 'opacity-80' : ''}`}>
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
                      <span className="text-sm text-muted">
                        Baris {r.rowNumber} · {style.label}
                        {r.reason ? ` — ${r.reason}` : ''}
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
              {save.isPending ? 'Menyimpan…' : `Import ${checked.size} anggota ke ${category?.name ?? ''}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
