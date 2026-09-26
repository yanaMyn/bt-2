import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asAnon, createDb } from './harness'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await db.exec(readFileSync(join(import.meta.dirname, '..', 'seed.sql'), 'utf8'))
})

describe('seed.sql', () => {
  it('membuat struktur, jamaah, dan kegiatan contoh', async () => {
    const r = await db.query<Record<string, number>>(`
      select (select count(*) from org_units)::int units,
             (select count(*) from categories)::int categories,
             (select count(*) from members)::int members,
             (select count(*) from sessions where closed_at is not null)::int closed`)
    expect(r.rows[0]).toEqual({ units: 6, categories: 5, members: 13, closed: 1 })
  })

  it('sesi Remaja 29 Agustus 2026 selesai: 4 peserta (16–19), sisanya dicatat Alpa', async () => {
    const r = await db.query<{ label: string; note: string; status: string; n: number }>(
      `select s.label, s.note, st.label status, count(*)::int n
       from sessions s join attendance a on a.session_id = s.id join statuses st on st.id = a.status_id
       where s.closed_at is not null group by s.label, s.note, st.label order by st.label`,
    )
    expect(r.rows).toEqual([
      { label: 'Sabtu, 29 Agustus 2026', note: 'Pertemuan akhir Agustus', status: 'Alpa', n: 2 },
      { label: 'Sabtu, 29 Agustus 2026', note: 'Pertemuan akhir Agustus', status: 'Hadir', n: 1 },
      { label: 'Sabtu, 29 Agustus 2026', note: 'Pertemuan akhir Agustus', status: 'Izin', n: 1 },
    ])
    const snap = await db.query(`select 1 from session_members`)
    expect(snap.rows).toHaveLength(4)
  })

  it('halaman Kelompok Baitul Ilmi: Remaja berjalan, Desaan CNT dijadwalkan, Pengajian Daerah tanpa jadwal', async () => {
    const r = await asAnon(db, (tx) =>
      tx.query<{ name: string; running: boolean; next: boolean; present: number }>(
        `select name, session_id is not null running, next_opens_at > now() next, present
         from public_kelompok_activities((select id from org_units where slug = 'baitul-ilmi')) order by name`,
      ),
    )
    expect(r.rows).toEqual([
      { name: 'Caberawit', running: false, next: null, present: 0 },
      { name: 'Desaan CNT', running: false, next: true, present: 0 },
      { name: 'Ibu-ibu', running: false, next: null, present: 0 },
      { name: 'Pengajian Daerah', running: false, next: null, present: 0 },
      { name: 'Remaja', running: true, next: null, present: 1 },
    ])
  })
})
