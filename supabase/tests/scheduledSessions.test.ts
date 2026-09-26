import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, createDb, errorOf, scheduleSession } from './harness'

let db: PGlite
let cat: string
let budi: string
let hadir: string

beforeEach(async () => {
  db = await createDb()
  cat = (await asAdmin(db, (tx) => tx.query<{ id: string }>(`select id from create_activity('Kelas A')`))).rows[0].id
  await asAdmin(db, (tx) =>
    tx.query(`select import_members('[{"name":"Ahmad","gender":"L"},{"name":"Budi","gender":"L"}]')`),
  )
  budi = (await db.query<{ id: string }>(`select id from members where name = 'Budi'`)).rows[0].id
  hadir = (await db.query<{ id: string }>(`select id from statuses where label = 'Hadir'`)).rows[0].id
})

const fill = () =>
  asAnon(db, (tx) => tx.query<{ session_id: string }>(`select * from set_attendance($1, $2, $3)`, [cat, budi, hadir]))
const schedule = (items: unknown[]) =>
  asAdmin(db, (tx) => tx.query(`select schedule_sessions($1, $2)`, [cat, JSON.stringify(items)]))
const row = async (id: string) =>
  (
    await db.query<Record<string, unknown>>(
      `select to_char(opens_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') opens,
              to_char(closes_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') closes,
              to_char(closed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') closed, label
       from sessions where id = $1`,
      [id],
    )
  ).rows[0]

describe('1.1 jam sesi & jendela waktu', () => {
  it('19.30–21.00 + 6 jam pada 5 Okt 2026 (WIB) → buka 12.30Z, tutup 20.00Z; ganti tanggal menggeser keduanya', async () => {
    await schedule([{ date: '2026-10-05', start: '19:30', end: '21:00', grace: 6 }])
    const id = (await db.query<{ id: string }>(`select id from sessions`)).rows[0].id
    expect(await row(id)).toMatchObject({ opens: '2026-10-05T12:30', closes: '2026-10-05T20:00', label: 'Senin, 5 Oktober 2026' })
    await asAdmin(db, (tx) => tx.query(`select update_session($1, '2026-10-08', '19:30', '21:00', 6, null)`, [id]))
    expect(await row(id)).toMatchObject({ opens: '2026-10-08T12:30', closes: '2026-10-08T20:00' })
  })

  it('menolak jam kosong, terbalik, dan toleransi di luar pilihan', async () => {
    for (const item of [
      { date: '2026-10-05', start: '19:30' },
      { date: '2026-10-05', start: '21:00', end: '19:30' },
    ]) {
      expect(await errorOf(schedule([item]))).toMatch(/INVALID_TIME/)
    }
    expect(await errorOf(schedule([{ date: '2026-10-05', start: '19:30', end: '21:00', grace: 7 }]))).toMatch(
      /INVALID_GRACE/,
    )
  })
})

describe('1.2 sesi berjalan ditentukan waktu', () => {
  it('sesi dijadwalkan (besok) ditolak', async () => {
    await scheduleSession(db, cat, { dayOffset: 1, start: '19:30', end: '21:00' })
    expect(await errorOf(fill())).toMatch(/NO_ACTIVE_SESSION/)
  })

  it('sesi berjalan (hari ini) diterima', async () => {
    const id = await scheduleSession(db, cat)
    expect((await fill()).rows[0].session_id).toBe(id)
  })

  it('sesi lewat batas (kemarin, tanpa toleransi) ditolak', async () => {
    await scheduleSession(db, cat, { dayOffset: -1 })
    expect(await errorOf(fill())).toMatch(/NO_ACTIVE_SESSION/)
  })

  it('dua sesi terbuka: sesi kemarin masih dalam toleransi 24 jam, sesi hari ini yang menerima isian', async () => {
    await scheduleSession(db, cat, { dayOffset: -1, grace: 24 })
    const today = await scheduleSession(db, cat)
    expect((await fill()).rows[0].session_id).toBe(today)
  })

  it('sesi lama tanpa jam tetap berjalan', async () => {
    const legacy = (
      await db.query<{ id: string }>(`insert into sessions (category_id, session_date) values ($1, today_jakarta()) returning id`, [cat])
    ).rows[0].id
    expect((await fill()).rows[0].session_id).toBe(legacy)
  })
})

describe('1.3 finalisasi otomatis', () => {
  it('sesi lewat batas ditutup pada batasnya dengan Alpa dan snapshot', async () => {
    const past = await scheduleSession(db, cat, { dayOffset: -1, start: '19:30', end: '21:00' })
    await db.query(`insert into attendance (session_id, member_id, status_id) values ($1, $2, $3)`, [past, budi, hadir])
    expect((await db.query<{ n: number }>(`select finalize_due_sessions() n`)).rows[0].n).toBe(1)

    const r = await row(past)
    expect(r.closed).toBe(r.closes)
    const att = await db.query<{ name: string; label: string }>(
      `select m.name, st.label from attendance a join members m on m.id = a.member_id
       join statuses st on st.id = a.status_id where a.session_id = $1 order by m.name`,
      [past],
    )
    expect(att.rows).toEqual([
      { name: 'Ahmad', label: 'Alpa' },
      { name: 'Budi', label: 'Hadir' },
    ])
    expect((await db.query(`select 1 from session_members where session_id = $1`, [past])).rows).toHaveLength(2)
    // Idempoten.
    expect((await db.query<{ n: number }>(`select finalize_due_sessions() n`)).rows[0].n).toBe(0)
  })

  it('sesi yang tergantikan ditutup pada jam buka sesi pengganti; pengisian memicu finalisasi', async () => {
    const old = await scheduleSession(db, cat, { dayOffset: -1, grace: 24 })
    const today = await scheduleSession(db, cat)
    await fill()
    const r = await row(old)
    expect(r.closed).toBe((await row(today)).opens)
  })

  it('sesi dijadwalkan tidak disentuh', async () => {
    const next = await scheduleSession(db, cat, { dayOffset: 2, start: '19:30', end: '21:00' })
    await db.query(`select finalize_due_sessions()`)
    expect((await row(next)).closed).toBeNull()
  })
})

describe('1.4 RPC admin sesi', () => {
  it('63 item ditolak; satu item tidak valid membatalkan semua', async () => {
    const many = Array.from({ length: 63 }, () => ({ date: '2026-10-05', start: '19:30', end: '21:00' }))
    expect(await errorOf(schedule(many))).toMatch(/TOO_MANY_SESSIONS/)
    expect(
      await errorOf(
        schedule([
          { date: '2026-10-05', start: '19:30', end: '21:00' },
          { date: '2026-10-08', start: '21:00', end: '19:30' },
        ]),
      ),
    ).toMatch(/INVALID_TIME/)
    expect((await db.query(`select 1 from sessions`)).rows).toHaveLength(0)
  })

  it('sesi selesai: jam tidak bisa diubah, tanggal & catatan bisa', async () => {
    const id = await scheduleSession(db, cat)
    await asAdmin(db, (tx) => tx.query(`select end_session($1)`, [cat]))
    const date = (await db.query<{ d: string }>(`select to_char(session_date, 'YYYY-MM-DD') d from sessions where id = $1`, [id]))
      .rows[0].d
    expect(
      await errorOf(asAdmin(db, (tx) => tx.query(`select update_session($1, $2, '19:30', '21:00', 0, null)`, [id, date]))),
    ).toMatch(/SESSION_FINISHED/)
    await asAdmin(db, (tx) => tx.query(`select update_session($1, '2020-01-01', '00:00', '23:59:59', 0, 'Catatan')`, [id]))
    expect((await row(id)).label).toBe('Rabu, 1 Januari 2020')
  })

  it('hapus hanya sesi dijadwalkan tanpa isian', async () => {
    const running = await scheduleSession(db, cat)
    const next = await scheduleSession(db, cat, { dayOffset: 3, start: '19:30', end: '21:00' })
    expect(await errorOf(asAdmin(db, (tx) => tx.query(`select delete_session($1)`, [running])))).toMatch(
      /SESSION_NOT_DELETABLE/,
    )
    await asAdmin(db, (tx) => tx.query(`select delete_session($1)`, [next]))
    expect((await db.query(`select 1 from sessions where id = $1`, [next])).rows).toHaveLength(0)
  })

  it('anon ditolak; finalize_due_sessions tidak bisa dipanggil anon', async () => {
    for (const sql of [
      `select schedule_sessions('${cat}', '[{"date":"2026-10-05","start":"19:30","end":"21:00"}]')`,
      `select update_session(gen_random_uuid(), '2026-10-05', '19:30', '21:00', 0, null)`,
      `select delete_session(gen_random_uuid())`,
    ]) {
      expect(await errorOf(asAnon(db, (tx) => tx.query(sql)))).toMatch(/NOT_ADMIN/)
    }
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select finalize_due_sessions()`)))).toMatch(/permission denied/)
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select finalize_category('${cat}')`)))).toMatch(/permission denied/)
  })
})

describe('1.5 ringkasan & statistik', () => {
  const summary = () =>
    asAnon(db, (tx) =>
      tx.query<{ running: boolean; next: boolean; start: string | null }>(
        `select session_id is not null running, next_opens_at is not null next,
                to_char(session_start_time, 'HH24:MI') start from public_kelompok_activities((select id from org_units where slug = 'baitul-ilmi'))`,
      ),
    )

  it('tanpa jadwal', async () => {
    expect((await summary()).rows).toEqual([{ running: false, next: false, start: null }])
  })

  it('menunggu sesi berikutnya', async () => {
    await scheduleSession(db, cat, { dayOffset: 1, start: '19:30', end: '21:00' })
    expect((await summary()).rows).toEqual([{ running: false, next: true, start: null }])
  })

  it('berjalan', async () => {
    await scheduleSession(db, cat)
    expect((await summary()).rows).toEqual([{ running: true, next: false, start: '00:00' }])
  })

  it('session_stats mengabaikan sesi dijadwalkan', async () => {
    await scheduleSession(db, cat)
    await scheduleSession(db, cat, { dayOffset: 1, start: '19:30', end: '21:00' })
    expect((await asAdmin(db, (tx) => tx.query(`select 1 from session_stats`))).rows).toHaveLength(1)
  })
})
