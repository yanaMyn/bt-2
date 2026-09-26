import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, errorOf, scheduleSession } from './harness'

let db: PGlite
let cat: string
let member: string
let hadir: string

beforeEach(async () => {
  db = await createDb()
  cat = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_activity('Desaan CNB')`))).rows[0].id
  await scheduleSession(db, cat)
  await asAdmin(db, (tx) => tx.query(`select import_members('[{"name":"Budi","gender":"L"}]')`))
  member = (await db.query<{ id: string }>(`select id from members`)).rows[0].id
  hadir = (await db.query<{ id: string }>(`select id from statuses where label = 'Hadir'`)).rows[0].id
})

const setActive = (active: boolean) =>
  asAdmin(db, (tx) => tx.query(`select set_category_active($1, $2)`, [cat, active]))

describe('13.1 kategori aktif/nonaktif', () => {
  it('kategori baru aktif dan terlihat anon', async () => {
    const r = await asAnon(db, (tx) => tx.query(`select name from public_kelompok_activities((select id from org_units where slug = 'baitul-ilmi'))`))
    expect(r.rows).toEqual([{ name: 'Desaan CNB' }])
  })

  it('kategori nonaktif hilang untuk anon (tabel & ringkasan) tetapi terlihat admin', async () => {
    await asAnon(db, (tx) =>
      tx.query(`select set_attendance($1, $2, $3)`, [cat, member, hadir]),
    )
    await setActive(false)
    expect((await asAnon(db, (tx) => tx.query(`select 1 from categories`))).rows).toHaveLength(0)
    expect((await asAnon(db, (tx) => tx.query(`select 1 from public_kelompok_activities((select id from org_units where slug = 'baitul-ilmi'))`))).rows).toHaveLength(0)
    const admin = await asAdmin(db, (tx) => tx.query(`select name, is_active, present from activity_summary`))
    expect(admin.rows).toEqual([{ name: 'Desaan CNB', is_active: false, present: 1 }])
  })

  it('menolak pengisian dan verifikasi PIN untuk kategori nonaktif', async () => {
    await setActive(false)
    expect(
      await errorOf(asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, member, hadir]))),
    ).toMatch(/CATEGORY_NOT_FOUND/)
    expect(
      await errorOf(asAnon(db, (tx) => tx.query(`select verify_category_pin($1, '1234')`, [cat]))),
    ).toMatch(/CATEGORY_NOT_FOUND/)
  })

  it('data tetap utuh setelah diaktifkan kembali', async () => {
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, member, hadir]))
    await setActive(false)
    await setActive(true)
    const r = await asAnon(db, (tx) => tx.query(`select total, present from public_kelompok_activities((select id from org_units where slug = 'baitul-ilmi'))`))
    expect(r.rows).toEqual([{ total: 1, present: 1 }])
  })

  it('hanya admin yang bisa mengubah status aktif', async () => {
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select set_category_active($1, false)`, [cat])))).toMatch(
      /NOT_ADMIN/,
    )
  })
})
