import * as XLSX from 'xlsx'
import type { MemberRecap, MonthRecap, SessionRecap } from './reports'
import type { Status } from './types'

export function fileSafe(s: string): string {
  return s
    .trim()
    .replace(/[\\/:*?"<>|,]+/g, '')
    .replace(/\s+/g, '-')
}

export function sessionRecapSheets(recap: SessionRecap): { name: string; rows: (string | number)[][] }[] {
  const { stats } = recap
  return [
    {
      name: 'Rekap',
      rows: [
        ['Status', 'Laki-laki', 'Perempuan', 'Total'],
        ...recap.rows.map((r) => [r.label, r.L, r.P, r.total]),
        ['% Hadir', `${stats.L.percent}%`, `${stats.P.percent}%`, `${stats.all.percent}%`],
        [
          'Hadir / Total',
          `${stats.L.present}/${stats.L.total}`,
          `${stats.P.present}/${stats.P.total}`,
          `${stats.all.present}/${stats.all.total}`,
        ],
        [],
        ['Sesi', recap.session.label],
        ['Catatan', recap.session.note ?? '-'],
      ],
    },
    {
      name: 'Anggota',
      rows: [
        ['No', 'Nama', 'Jenis Kelamin', 'Status'],
        ...recap.members.map((m, i) => [i + 1, m.member.name, m.member.gender, m.status?.label ?? 'Belum']),
      ],
    },
  ]
}

export function memberRecapSheet(recap: MemberRecap): (string | number)[][] {
  const cols: Status[] = recap.statuses
  return [
    ['No', 'Nama', 'Jenis Kelamin', ...cols.map((s) => s.label), 'Belum', 'Jumlah Sesi', '% Hadir'],
    ...recap.rows.map((r, i) => [
      i + 1,
      r.member.name,
      r.member.gender,
      ...cols.map((s) => r.counts.get(s.id) ?? 0),
      r.belum,
      r.sessions,
      `${r.percent}%`,
    ]),
  ]
}

export function downloadSheets(fileName: string, sheets: { name: string; rows: (string | number)[][] }[]): void {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name)
  XLSX.writeFile(wb, `${fileSafe(fileName)}.xlsx`)
}

export function monthRecapSheets(recap: MonthRecap): { name: string; rows: (string | number)[][] }[] {
  const { stats } = recap
  return [
    {
      name: 'Rekap',
      rows: [
        ['Status (jumlah isian)', 'Laki-laki', 'Perempuan', 'Total'],
        ...recap.rows.map((r) => [r.label, r.L, r.P, r.total]),
        ['% Hadir', `${stats.L.percent}%`, `${stats.P.percent}%`, `${stats.all.percent}%`],
        [
          'Hadir / Total',
          `${stats.L.present}/${stats.L.total}`,
          `${stats.P.present}/${stats.P.total}`,
          `${stats.all.present}/${stats.all.total}`,
        ],
        [],
        ['Sesi tercakup', 'Catatan'],
        ...recap.sessions.map((s) => [s.label, s.note ?? '']),
      ],
    },
    { name: 'Anggota', rows: memberRecapSheet(recap.members) },
  ]
}
