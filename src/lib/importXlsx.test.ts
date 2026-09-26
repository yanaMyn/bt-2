import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  classifyImportRows,
  ImportFormatError,
  isXlsxFile,
  normalizeGender,
  parseWorkbook,
  templateWorkbook,
} from './importXlsx'

function workbook(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

describe('parseWorkbook', () => {
  it('mencocokkan header tanpa membedakan huruf besar dan urutan kolom', () => {
    const rows = parseWorkbook(
      workbook([
        ['No', 'JENIS KELAMIN', ' nama '],
        [1, 'L', 'Budi'],
        [2, '', ''],
        [3, 'p', 'Citra'],
      ]),
    )
    expect(rows).toEqual([
      { rowNumber: 2, rawName: 'Budi', rawGender: 'L' },
      { rowNumber: 4, rawName: 'Citra', rawGender: 'p' },
    ])
  })

  it('menolak file tanpa kolom wajib', () => {
    expect(() => parseWorkbook(workbook([['Nama', 'Kelas']]))).toThrow(ImportFormatError)
  })

  it('template yang diunduh bisa dibaca kembali', () => {
    const buf = XLSX.write(templateWorkbook(), { type: 'array', bookType: 'xlsx' })
    expect(parseWorkbook(buf).map((r) => r.rawName)).toEqual(['Ahmad Fauzi', 'Citra Dewi'])
  })
})

describe('normalizeGender', () => {
  it.each([
    ['L', 'L'],
    [' l ', 'L'],
    ['Laki-laki', 'L'],
    ['Laki-Laki', 'L'],
    ['LAKI-LAKI', 'L'],
    ['P', 'P'],
    ['p', 'P'],
    ['Perempuan', 'P'],
    ['Pria', null],
    ['', null],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeGender(raw)).toBe(expected)
  })
})

describe('classifyImportRows', () => {
  const row = (n: number, rawName: string, rawGender: string) => ({ rowNumber: n, rawName, rawGender })

  it('mengklasifikasikan valid, tidak valid, dan duplikat', () => {
    const result = classifyImportRows(
      [
        row(2, ' Ahmad   Fauzi ', 'L'),
        row(3, '', 'P'),
        row(4, 'Dina', 'X'),
        row(5, 'budi', 'l'),
        row(6, 'Ahmad Fauzi', 'Laki-laki'),
        row(7, 'Budi', 'P'),
      ],
      [{ name: 'Budi', gender: 'L' }],
    )
    expect(result.map((r) => [r.rowNumber, r.kind, r.name, r.gender])).toEqual([
      [2, 'valid', 'Ahmad Fauzi', 'L'],
      [3, 'invalid', '', 'P'],
      [4, 'invalid', 'Dina', null],
      [5, 'duplicate', 'budi', 'L'],
      [6, 'duplicate', 'Ahmad Fauzi', 'L'],
      [7, 'valid', 'Budi', 'P'],
    ])
  })
})

describe('isXlsxFile', () => {
  it('hanya menerima .xlsx', () => {
    expect(isXlsxFile('data.XLSX')).toBe(true)
    expect(isXlsxFile('data.xls')).toBe(false)
    expect(isXlsxFile('data.csv')).toBe(false)
  })
})
