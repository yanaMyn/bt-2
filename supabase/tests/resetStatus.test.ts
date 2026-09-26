import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, endAndOpen, errorOf, scheduleSession } from './harness'

let db: PGlite
let cat: string

const statusId = async (label: string, category = cat) =>
  (await db.query<{ id: string }>(`select id from statuses where category_id = $1 and label = $2`, [category, label]))
    .rows[0].id
const memberId = async (name: string) =>
  (await db.query<{ id: string }>(`select id from members where name = $1`, [name])).rows[0].id
const resetStatus = async () =>
  (await asAdmin(db, (tx) => tx.query<{ r: string | null }>(`select reset_status_id r from categories where id = $1`, [cat])))
    .rows[0].r

beforeEach(async () => {
  db = await createDb()
  cat = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_activity('Kelas A')`))).rows[0].id
  await scheduleSession(db, cat)
  await asAdmin(db, (tx) =>
    tx.query(`select import_members($1)`, [JSON.stringify([
        { name: 'Ahmad', gender: 'L' },
        { name: 'Budi', gender: 'L' },
        { name: 'Citra', gender: 'P' },
      ]),
    ]),
  )
})

describe('16.1 status otomatis saat reset', () => {
  it('kategori baru memakai Alpa', async () => {
    expect(await resetStatus()).toBe(await statusId('Alpa'))
  })

  it('reset mencatat Alpa hanya untuk yang belum mengisi; sesi baru tetap kosong', async () => {
    const hadir = await statusId('Hadir')
    const ahmad = await memberId('Ahmad')
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [cat, ahmad, hadir]))
    const old = (await db.query<{ id: string }>(`select id from sessions where closed_at is null`)).rows[0].id
    await endAndOpen(db, cat)

    const rows = await db.query<{ name: string; label: string }>(
      `select m.name, s.label from attendance a join members m on m.id = a.member_id
       join statuses s on s.id = a.status_id where a.session_id = $1 order by m.name`,
      [old],
    )
    expect(rows.rows).toEqual([
      { name: 'Ahmad', label: 'Hadir' },
      { name: 'Budi', label: 'Alpa' },
      { name: 'Citra', label: 'Alpa' },
    ])
    const fresh = await db.query(`select 1 from attendance a join sessions s on s.id = a.session_id where s.closed_at is null`)
    expect(fresh.rows).toHaveLength(0)
  })

  it('"Tidak ada" membiarkan yang belum mengisi tetap Belum', async () => {
    await asAdmin(db, (tx) => tx.query(`select set_reset_status($1, null)`, [cat]))
    await endAndOpen(db, cat)
    expect((await db.query(`select 1 from attendance`)).rows).toHaveLength(0)
  })

  it('bisa diganti ke status lain milik kategori; status kategori lain & anon ditolak', async () => {
    const izin = await statusId('Izin')
    await asAdmin(db, (tx) => tx.query(`select set_reset_status($1, $2)`, [cat, izin]))
    expect(await resetStatus()).toBe(izin)

    const other = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_activity('Kajian')`))).rows[0].id
    const otherAlpa = await statusId('Alpa', other)
    expect(await errorOf(asAdmin(db, (tx) => tx.query(`select set_reset_status($1, $2)`, [cat, otherAlpa])))).toMatch(
      /INVALID_STATUS/,
    )
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select set_reset_status($1, null)`, [cat])))).toMatch(/NOT_ADMIN/)
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select reset_status_id from categories`)))).toMatch(
      /permission denied/,
    )
  })

  it('mengarsipkan status otomatis mengosongkan pengaturan', async () => {
    const alpa = await statusId('Alpa')
    await endAndOpen(db, cat) // Alpa jadi terpakai
    const r = await asAdmin(db, (tx) => tx.query<{ r: string }>(`select delete_status($1) r`, [alpa]))
    expect(r.rows[0].r).toBe('archived')
    expect(await resetStatus()).toBeNull()
  })
})
