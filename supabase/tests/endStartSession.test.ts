import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, errorOf, scheduleSession } from './harness'

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
  await scheduleSession(db, cat)
})

const end = () => asAdmin(db, (tx) => tx.query(`select end_session($1)`, [cat]))
const fill = () => asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, budi, hadir]))

describe('akhiri sesi', () => {
  it('yang belum mengisi dicatat Alpa, kategori tanpa sesi berjalan', async () => {
    await fill()
    await end()
    const open = await db.query(`select 1 from sessions where category_id = $1 and closed_at is null`, [cat])
    expect(open.rows).toHaveLength(0)
    const rows = await db.query<{ name: string; label: string }>(
      `select m.name, st.label from attendance a join members m on m.id = a.member_id
       join statuses st on st.id = a.status_id order by m.name`,
    )
    expect(rows.rows).toEqual([
      { name: 'Ahmad', label: 'Alpa' },
      { name: 'Budi', label: 'Hadir' },
    ])
  })

  it('tanpa sesi berjalan: pengisian ditolak, ringkasan tanpa sesi, akhiri lagi ditolak', async () => {
    await end()
    expect(await errorOf(fill())).toMatch(/NO_ACTIVE_SESSION/)
    const sum = await asAnon(db, (tx) =>
      tx.query(`select name, session_id, session_label, total, present from category_summary`),
    )
    expect(sum.rows).toEqual([{ name: 'Kelas A', session_id: null, session_label: null, total: 2, present: 0 }])
    expect(await errorOf(end())).toMatch(/NO_ACTIVE_SESSION/)
  })

  it('tidak mengubah sesi yang masih dijadwalkan', async () => {
    await scheduleSession(db, cat, { dayOffset: 3, start: '19:30', end: '21:00' })
    await end()
    const scheduled = await db.query(`select 1 from sessions where category_id = $1 and closed_at is null`, [cat])
    expect(scheduled.rows).toHaveLength(1)
  })

  it('hanya admin', async () => {
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select end_session($1)`, [cat])))).toMatch(/NOT_ADMIN/)
  })
})
