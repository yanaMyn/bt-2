import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  classifyImportRows,
  ImportFormatError,
  isXlsxFile,
  normalizeBirth,
  normalizeMarital,
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
      { rowNumber: 2, rawName: 'Budi', rawGender: 'L', rawBirth: '', rawMarital: '' },
      { rowNumber: 4, rawName: 'Citra', rawGender: 'p', rawBirth: '', rawMarital: '' },
    ])
  })

  it('menolak file tanpa kolom wajib', () => {
    expect(() => parseWorkbook(workbook([['Nama', 'Kelas']]))).toThrow(ImportFormatError)
  })

  it('template yang diunduh bisa dibaca kembali', () => {
    const buf = XLSX.write(templateWorkbook(), { type: 'array', bookType: 'xlsx' })
    expect(parseWorkbook(buf).map((r) => r.rawName)).toEqual(['Ahmad Fauzi', 'Citra Dewi', 'Siti Aminah'])
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
  const row = (n: number, rawName: string, rawGender: string, rawBirth: unknown = '', rawMarital = '') => ({
    rowNumber: n,
    rawName,
    rawGender,
    rawBirth,
    rawMarital,
  })

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
      '2026-10-05',
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

describe('tanggal lahir & status nikah', () => {
  const T = '2026-10-05'
  it('normalizeBirth: Date Excel, DD/MM/YYYY, YYYY-MM-DD, kosong, tidak valid, masa depan', () => {
    expect(normalizeBirth(new Date(2012, 4, 12), T)).toEqual({ value: '2012-05-12' })
    expect(normalizeBirth('12/05/2012', T)).toEqual({ value: '2012-05-12' })
    expect(normalizeBirth('2012-5-12', T)).toEqual({ value: '2012-05-12' })
    expect(normalizeBirth('  ', T)).toEqual({ value: null })
    expect(normalizeBirth('31/02/2012', T)).toEqual({ error: 'Tanggal lahir tidak valid' })
    expect(normalizeBirth('kemarin', T)).toEqual({ error: 'Tanggal lahir "kemarin" tidak terbaca' })
    expect(normalizeBirth('2027-01-01', T)).toEqual({ error: 'Tanggal lahir di masa depan' })
  })

  it('normalizeMarital', () => {
    expect(['', 'Belum', 'belum menikah', 'Menikah', 'Janda', 'duda', 'Janda/Duda', 'cerai'].map(normalizeMarital)).toEqual([
      'belum',
      'belum',
      'belum',
      'menikah',
      'janda_duda',
      'janda_duda',
      'janda_duda',
      null,
    ])
  })

  it('klasifikasi: tanggal/status tidak valid dilewati, tanpa tanggal lahir ditandai belum lengkap', () => {
    const r = (n: number, birth: unknown, marital: string) => ({
      rowNumber: n,
      rawName: `Orang ${n}`,
      rawGender: 'L',
      rawBirth: birth,
      rawMarital: marital,
    })
    const out = classifyImportRows([r(2, '12/05/2012', 'Belum'), r(3, '', 'Menikah'), r(4, 'x', ''), r(5, '', 'cerai')], [], T)
    expect(out.map((o) => [o.kind, o.birth_date, o.marital, o.incomplete])).toEqual([
      ['valid', '2012-05-12', 'belum', false],
      ['valid', null, 'menikah', true],
      ['invalid', null, 'belum', false],
      ['invalid', null, null, false],
    ])
  })

  it('template berisi 4 kolom dan bisa dibaca kembali dengan tanggal', () => {
    const buf = XLSX.write(templateWorkbook(), { type: 'array', bookType: 'xlsx' })
    const rows = parseWorkbook(buf)
    const out = classifyImportRows(rows, [], T)
    expect(out.map((o) => [o.name, o.birth_date, o.marital])).toEqual([
      ['Ahmad Fauzi', '2009-05-12', 'belum'],
      ['Citra Dewi', '1988-02-14', 'menikah'],
      ['Siti Aminah', null, 'janda_duda'],
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
