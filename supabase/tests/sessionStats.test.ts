import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, endAndOpen, scheduleSession } from './harness'

let db: PGlite
let cat: string

async function ids(label: string) {
  return (await db.query<{ id: string }>(`select id from statuses where category_id = $1 and label = $2`, [cat, label]))
    .rows[0].id
}

async function set(memberName: string, label: string) {
  const m = (await db.query<{ id: string }>(`select id from members where name = $1`, [memberName])).rows[0].id
  const status = await ids(label)
  await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, m, status]))
}

beforeEach(async () => {
  db = await createDb()
  cat = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_category('Kelas A')`))).rows[0].id
  await scheduleSession(db, cat)
  await asAdmin(db, (tx) =>
    tx.query(`select import_members($1, $2)`, [
      cat,
      JSON.stringify([
        { name: 'Ahmad', gender: 'L' },
        { name: 'Budi', gender: 'L' },
        { name: 'Citra', gender: 'P' },
        { name: 'Dina', gender: 'P' },
      ]),
    ]),
  )
})

describe('14.1 session_stats', () => {
  it('menghitung sesi tertutup dari snapshot dan sesi aktif dari keanggotaan saat ini', async () => {
    await set('Ahmad', 'Hadir')
    await set('Budi', 'Hadir')
    await set('Citra', 'Izin')
    await endAndOpen(db, cat)
    // Setelah reset: Dina dikeluarkan, Ahmad hadir di sesi aktif.
    await asAdmin(db, (tx) =>
      tx.query(`delete from category_members where member_id = (select id from members where name = 'Dina')`),
    )
    await set('Ahmad', 'Hadir')

    const r = await asAnon(db, (tx) =>
      tx.query<{ label: string; total: number; present: number; closed: boolean }>(
        `select label, total, present, closed_at is not null closed from session_stats order by started_at, closed_at nulls last`,
      ),
    )
    expect(r.rows.map((x) => [x.closed, x.total, x.present])).toEqual([
      [true, 4, 2],
      [false, 3, 1],
    ])
  })

  it('bulan sesi mengikuti tanggal sesi, bukan waktu reset', async () => {
    await db.query(
      `update sessions set session_date = '2020-09-30', started_at = '2020-10-02T03:00:00Z' where category_id = $1`,
      [cat],
    )
    const r = await db.query<{ month: string; label: string }>(`select month, label from session_stats`)
    expect(r.rows).toEqual([{ month: '2020-09', label: 'Rabu, 30 September 2020' }])
  })
})
