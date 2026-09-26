import * as XLSX from 'xlsx'
import type { Gender, Marital } from './types'

export const TEMPLATE_HEADERS = ['Nama', 'Jenis Kelamin', 'Tanggal Lahir', 'Status Nikah'] as const

export class ImportFormatError extends Error {}

export interface ParsedRow {
  /** Nomor baris di Excel (1-based, termasuk header). */
  rowNumber: number
  rawName: string
  rawGender: string
  /** Date (sel tanggal Excel), teks, atau kosong. */
  rawBirth: unknown
  rawMarital: string
}

export type RowKind = 'valid' | 'invalid' | 'duplicate'

export interface ClassifiedRow extends ParsedRow {
  name: string
  gender: Gender | null
  /** YYYY-MM-DD atau null */
  birth_date: string | null
  marital: Marital | null
  kind: RowKind
  reason: string | null
  /** Valid tetapi tanpa tanggal lahir (tidak masuk kegiatan berbatas umur). */
  incomplete: boolean
}

export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

export function normalizeGender(raw: string): Gender | null {
  const v = raw.trim().toLowerCase()
  if (v === 'l' || v === 'laki-laki') return 'L'
  if (v === 'p' || v === 'perempuan') return 'P'
  return null
}

/** Kosong = belum menikah; null = tidak dikenali. */
export function normalizeMarital(raw: string): Marital | null {
  const v = raw.trim().toLowerCase()
  if (v === '' || v === 'belum' || v === 'belum menikah') return 'belum'
  if (v === 'menikah' || v === 'sudah menikah') return 'menikah'
  if (v === 'janda' || v === 'duda' || v === 'janda/duda') return 'janda_duda'
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/**
 * Tanggal lahir dari sel Excel (Date), "DD/MM/YYYY", atau "YYYY-MM-DD".
 * Hasil: { value } (null = kosong) atau { error }.
 */
export function normalizeBirth(raw: unknown, today: string): { value: string | null } | { error: string } {
  let value: string | null = null
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { error: 'Tanggal lahir tidak terbaca' }
    // Sel tanggal dibaca sebagai waktu lokal tengah malam; ambil komponen lokalnya.
    value = validDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate())
  } else {
    const s = String(raw ?? '').trim()
    if (!s) return { value: null }
    let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
    if (m) value = validDate(Number(m[3]), Number(m[2]), Number(m[1]))
    else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) value = validDate(Number(m[1]), Number(m[2]), Number(m[3]))
    else return { error: `Tanggal lahir "${s}" tidak terbaca` }
  }
  if (!value) return { error: 'Tanggal lahir tidak valid' }
  if (value > today) return { error: 'Tanggal lahir di masa depan' }
  return { value }
}

const dupKey = (name: string, gender: Gender) => `${normalizeName(name).toLocaleLowerCase('id')}|${gender}`

export function isXlsxFile(fileName: string): boolean {
  return /\.xlsx$/i.test(fileName)
}

/**
 * Baca sheet pertama; header dicocokkan tanpa membedakan huruf besar. "Nama" dan "Jenis Kelamin"
 * wajib; "Tanggal Lahir" dan "Status Nikah" opsional.
 */
export function parseWorkbook(data: ArrayBuffer): ParsedRow[] {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(data, { type: 'array', cellDates: true })
  } catch {
    throw new ImportFormatError('File tidak bisa dibaca sebagai .xlsx.')
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new ImportFormatError('File tidak berisi sheet.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '', raw: true })
  const header = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase())
  const nameCol = header.indexOf('nama')
  const genderCol = header.indexOf('jenis kelamin')
  const birthCol = header.indexOf('tanggal lahir')
  const maritalCol = header.indexOf('status nikah')
  if (nameCol < 0 || genderCol < 0) {
    throw new ImportFormatError(
      'Format file tidak sesuai template: kolom "Nama" dan "Jenis Kelamin" wajib ada di baris pertama.',
    )
  }
  const out: ParsedRow[] = []
  rows.slice(1).forEach((r, i) => {
    const rawName = String(r[nameCol] ?? '')
    const rawGender = String(r[genderCol] ?? '')
    if (!rawName.trim() && !rawGender.trim()) return // baris kosong diabaikan
    out.push({
      rowNumber: i + 2,
      rawName,
      rawGender,
      rawBirth: birthCol >= 0 ? r[birthCol] : '',
      rawMarital: maritalCol >= 0 ? String(r[maritalCol] ?? '') : '',
    })
  })
  return out
}

/**
 * valid = akan dibuat; invalid = nama kosong / jenis kelamin / tanggal lahir / status nikah tidak dikenali
 * (selalu dilewati); duplicate = sama persis dengan jamaah aktif kelompok atau baris sebelumnya di file.
 */
export function classifyImportRows(
  rows: readonly ParsedRow[],
  existingInKelompok: readonly { name: string; gender: Gender }[],
  today: string,
): ClassifiedRow[] {
  const existing = new Set(existingInKelompok.map((m) => dupKey(m.name, m.gender)))
  const seen = new Set<string>()
  return rows.map((r) => {
    const name = normalizeName(r.rawName)
    const gender = normalizeGender(r.rawGender)
    const marital = normalizeMarital(r.rawMarital)
    const birth = normalizeBirth(r.rawBirth, today)
    const birth_date = 'value' in birth ? birth.value : null
    const base = { ...r, name, gender, birth_date, marital, incomplete: false }
    const invalid = (reason: string): ClassifiedRow => ({ ...base, kind: 'invalid', reason })
    if (!name) return invalid('Nama kosong')
    if (!gender)
      return invalid(r.rawGender.trim() ? `Jenis kelamin "${r.rawGender.trim()}" tidak dikenali` : 'Jenis kelamin kosong')
    if ('error' in birth) return invalid(birth.error)
    if (!marital) return invalid(`Status nikah "${r.rawMarital.trim()}" tidak dikenali`)
    const incomplete = birth_date === null
    const key = dupKey(name, gender)
    if (existing.has(key)) return { ...base, incomplete, kind: 'duplicate', reason: 'Sudah ada di kelompok ini' }
    if (seen.has(key)) {
      return { ...base, incomplete, kind: 'duplicate', reason: 'Nama sama muncul lebih dari sekali di file' }
    }
    seen.add(key)
    return { ...base, incomplete, kind: 'valid', reason: null }
  })
}

export function templateWorkbook(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    ['Ahmad Fauzi', 'L', '12/05/2009', 'Belum'],
    ['Citra Dewi', 'P', '1988-02-14', 'Menikah'],
    ['Siti Aminah', 'P', '', 'Janda'],
  ])
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  const info = XLSX.utils.aoa_to_sheet([
    ['Kolom', 'Nilai yang diterima'],
    ['Jenis Kelamin', 'L, P, Laki-laki, Perempuan'],
    ['Tanggal Lahir', 'Tanggal Excel, DD/MM/YYYY, atau YYYY-MM-DD (boleh kosong)'],
    ['Status Nikah', 'Belum / Belum Menikah, Menikah, Janda, Duda (kosong = belum menikah)'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Jamaah')
  XLSX.utils.book_append_sheet(wb, info, 'Keterangan')
  return wb
}

export function downloadTemplate(): void {
  XLSX.writeFile(templateWorkbook(), 'template-import-jamaah.xlsx')
}
