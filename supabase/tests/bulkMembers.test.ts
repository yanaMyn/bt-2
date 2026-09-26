import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, errorOf, scheduleSession } from './harness'

let db: PGlite
let a: string
let b: string
let ids: Record<string, string>

beforeEach(async () => {
  db = await createDb()
  a = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_category('Kelas A')`))).rows[0].id
  await scheduleSession(db, a)
  b = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_category('Kajian')`))).rows[0].id
  await asAdmin(db, (tx) =>
    tx.query(`select import_members($1, $2)`, [
      a,
      JSON.stringify(['Ahmad', 'Budi', 'Citra', 'Dina'].map((name) => ({ name, gender: 'L' }))),
    ]),
  )
  ids = Object.fromEntries(
    (await db.query<{ id: string; name: string }>(`select id, name from members`)).rows.map((r) => [r.name, r.id]),
  )
  await asAdmin(db, (tx) => tx.query(`insert into category_members values ($1, $2)`, [b, ids.Ahmad]))
  const hadir = (await db.query<{ id: string }>(`select id from statuses where category_id = $1 and label = 'Hadir'`, [a]))
    .rows[0].id
  for (const n of ['Ahmad', 'Budi']) {
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [a, ids[n], hadir]))
  }
})

const count = async (sql: string, params: unknown[] = []) =>
  (await db.query<{ n: number }>(`select count(*)::int n from ${sql}`, params)).rows[0].n

describe('18.1 aksi massal anggota', () => {
  it('keluarkan massal hanya dari kategori itu', async () => {
    const r = await asAdmin(db, (tx) =>
      tx.query<{ n: number }>(`select remove_members_from_category($1, $2) n`, [a, [ids.Ahmad, ids.Citra]]),
    )
    expect(r.rows[0].n).toBe(2)
    expect(await count(`category_members where category_id = $1`, [a])).toBe(2)
    expect(await count(`category_members where category_id = $1`, [b])).toBe(1)
    expect(await count(`members`)).toBe(4)
  })

  it('menghitung riwayat lalu menghapus massal beserta riwayatnya', async () => {
    const h = await asAdmin(db, (tx) =>
      tx.query(`select * from members_with_history($1)`, [[ids.Ahmad, ids.Budi, ids.Citra]]),
    )
    expect(h.rows[0]).toEqual({ people: 2, records: 2 })
    const r = await asAdmin(db, (tx) => tx.query<{ n: number }>(`select delete_members($1) n`, [[ids.Ahmad, ids.Budi, ids.Citra]]))
    expect(r.rows[0].n).toBe(3)
    expect(await count(`members`)).toBe(1)
    expect(await count(`attendance`)).toBe(0)
    expect(await count(`category_members where category_id = $1`, [b])).toBe(0)
  })

  it('hanya admin', async () => {
    for (const sql of [
      `select remove_members_from_category('${a}', array['${ids.Ahmad}']::uuid[])`,
      `select delete_members(array['${ids.Ahmad}']::uuid[])`,
      `select * from members_with_history(array['${ids.Ahmad}']::uuid[])`,
    ]) {
      expect(await errorOf(asAnon(db, (tx) => tx.query(sql)))).toMatch(/NOT_ADMIN/)
    }
    expect(await count(`members`)).toBe(4)
  })
})
