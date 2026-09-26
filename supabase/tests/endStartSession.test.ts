import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, errorOf } from './harness'

let db: PGlite
let cat: string
let budi: string
let hadir: string

beforeEach(async () => {
  db = await createDb()
  cat = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_category('Kelas A')`))).rows[0].id
  await asAdmin(db, (tx) =>
    tx.query(`select import_members($1, '[{"name":"Ahmad","gender":"L"},{"name":"Budi","gender":"L"}]')`, [cat]),
  )
  budi = (await db.query<{ id: string }>(`select id from members where name = 'Budi'`)).rows[0].id
  hadir = (await db.query<{ id: string }>(`select id from statuses where label = 'Hadir'`)).rows[0].id
})

const end = () => asAdmin(db, (tx) => tx.query(`select end_session($1)`, [cat]))
const start = (date = '2026-10-03', note: string | null = 'Pekan 1') =>
  asAdmin(db, (tx) => tx.query(`select start_session($1, $2, $3)`, [cat, date, note]))
const activeCount = async () =>
  (await db.query<{ n: number }>(`select count(*)::int n from sessions where category_id = $1 and closed_at is null`, [cat]))
    .rows[0].n

describe('17.1 akhiri sesi & buat sesi baru', () => {
  it('akhiri sesi: yang belum mengisi dicatat Alpa, kategori tanpa sesi berjalan', async () => {
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, budi, hadir]))
    await end()
    expect(await activeCount()).toBe(0)
    const rows = await db.query<{ name: string; label: string }>(
      `select m.name, st.label from attendance a join members m on m.id = a.member_id
       join statuses st on st.id = a.status_id order by m.name`,
    )
    expect(rows.rows).toEqual([
      { name: 'Ahmad', label: 'Alpa' },
      { name: 'Budi', label: 'Hadir' },
    ])
  })

  it('tanpa sesi berjalan: pengisian ditolak dan kategori tetap di ringkasan tanpa sesi', async () => {
    await end()
    expect(
      await errorOf(asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, budi, hadir]))),
    ).toMatch(/NO_ACTIVE_SESSION/)
    const sum = await asAnon(db, (tx) =>
      tx.query(`select name, session_id, session_label, total, present from category_summary`),
    )
    expect(sum.rows).toEqual([{ name: 'Kelas A', session_id: null, session_label: null, total: 2, present: 0 }])
    expect(await errorOf(end())).toMatch(/NO_ACTIVE_SESSION/)
  })

  it('buat sesi baru hanya bila tidak ada sesi aktif', async () => {
    expect(await errorOf(start())).toMatch(/SESSION_ALREADY_ACTIVE/)
    await end()
    await start()
    const s = await db.query<{ label: string; note: string }>(
      `select label, note from sessions where category_id = $1 and closed_at is null`,
      [cat],
    )
    expect(s.rows).toEqual([{ label: 'Sabtu, 3 Oktober 2026', note: 'Pekan 1' }])
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, budi, hadir]))
  })

  it('hanya admin', async () => {
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select end_session($1)`, [cat])))).toMatch(/NOT_ADMIN/)
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select start_session($1)`, [cat])))).toMatch(/NOT_ADMIN/)
  })
})
