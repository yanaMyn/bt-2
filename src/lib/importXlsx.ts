import * as XLSX from 'xlsx'
import type { Gender } from './types'

export const TEMPLATE_HEADERS = ['Nama', 'Jenis Kelamin'] as const

export class ImportFormatError extends Error {}

export interface ParsedRow {
  /** Nomor baris di Excel (1-based, termasuk header). */
  rowNumber: number
  rawName: string
  rawGender: string
}

export type RowKind = 'valid' | 'invalid' | 'duplicate'

export interface ClassifiedRow extends ParsedRow {
  name: string
  gender: Gender | null
  kind: RowKind
  reason: string | null
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

const dupKey = (name: string, gender: Gender) => `${normalizeName(name).toLocaleLowerCase('id')}|${gender}`

export function isXlsxFile(fileName: string): boolean {
  return /\.xlsx$/i.test(fileName)
}

/** Baca sheet pertama; header "Nama" dan "Jenis Kelamin" dicocokkan tanpa membedakan huruf besar. */
export function parseWorkbook(data: ArrayBuffer): ParsedRow[] {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(data, { type: 'array' })
  } catch {
    throw new ImportFormatError('File tidak bisa dibaca sebagai .xlsx.')
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new ImportFormatError('File tidak berisi sheet.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '', raw: false })
  const header = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase())
  const nameCol = header.indexOf('nama')
  const genderCol = header.indexOf('jenis kelamin')
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
    out.push({ rowNumber: i + 2, rawName, rawGender })
  })
  return out
}

/**
 * valid = akan dibuat; invalid = nama kosong / jenis kelamin tidak dikenali (selalu dilewati);
 * duplicate = sama persis dengan anggota kategori tujuan atau baris sebelumnya di file.
 */
export function classifyImportRows(
  rows: readonly ParsedRow[],
  existingInCategory: readonly { name: string; gender: Gender }[],
): ClassifiedRow[] {
  const existing = new Set(existingInCategory.map((m) => dupKey(m.name, m.gender)))
  const seen = new Set<string>()
  return rows.map((r) => {
    const name = normalizeName(r.rawName)
    const gender = normalizeGender(r.rawGender)
    if (!name) return { ...r, name, gender, kind: 'invalid', reason: 'Nama kosong' }
    if (!gender)
      return {
        ...r,
        name,
        gender,
        kind: 'invalid',
        reason: r.rawGender.trim() ? `Jenis kelamin "${r.rawGender.trim()}" tidak dikenali` : 'Jenis kelamin kosong',
      }
    const key = dupKey(name, gender)
    if (existing.has(key)) return { ...r, name, gender, kind: 'duplicate', reason: 'Sudah ada di kategori ini' }
    if (seen.has(key)) {
      return { ...r, name, gender, kind: 'duplicate', reason: 'Nama sama muncul lebih dari sekali di file' }
    }
    seen.add(key)
    return { ...r, name, gender, kind: 'valid', reason: null }
  })
}

export function templateWorkbook(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], ['Ahmad Fauzi', 'L'], ['Citra Dewi', 'P']])
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Anggota')
  return wb
}

export function downloadTemplate(): void {
  XLSX.writeFile(templateWorkbook(), 'template-import-anggota.xlsx')
}
