import type { PGlite, Transaction } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { asAdmin, asAnon, asUser, createDb, endAndOpen, errorOf, orgFor, scheduleFor, scheduleSession } from './harness'

type Q = PGlite | Transaction

async function one<T>(q: Q, sql: string, params: unknown[] = []): Promise<T> {
  const res = await q.query<T>(sql, params)
  return res.rows[0]
}

/** Buat kategori; default langsung dijadwalkan satu sesi yang berjalan hari ini. */
async function createCategory(db: PGlite, name: string, withSession = true) {
  const cat = await asAdmin(db, (tx) => one<{ id: string; slug: string }>(tx, `select * from create_activity($1)`, [name]))
  if (withSession) await scheduleSession(db, cat.id)
  return cat
}

/** Kategori milik Kelompok Citra (anggota terpisah dari kategori milik Baitul Ilmi). */
async function createCategoryInCitra(db: PGlite, name: string) {
  const org = await orgFor(db)
  const cat = await asUser(db, org.users.citra, (tx) =>
    one<{ id: string; slug: string }>(tx, `select * from create_activity($1)`, [name]),
  )
  await scheduleFor(db, org.users.citra, cat.id)
  return cat
}

/** Import jamaah ke kelompok pemilik kategori; mengembalikan jamaah kelompok itu (= peserta kategori). */
async function addMembers(db: PGlite, categoryId: string, rows: { name: string; gender: string }[]) {
  const owner = await one<{ user_id: string; unit_id: string }>(
    db,
    `select p.user_id, p.unit_id from categories c join admin_profiles p on p.unit_id = c.owner_unit_id
     where c.id = $1 order by p.created_at limit 1`,
    [categoryId],
  )
  await asUser(db, owner.user_id, (tx) => tx.query(`select import_members($1)`, [JSON.stringify(rows)]))
  const res = await db.query<{ id: string; name: string }>(
    `select id, name from members where kelompok_id = $1 order by name`,
    [owner.unit_id],
  )
  return res.rows
}

async function statusId(db: PGlite, categoryId: string, label: string) {
  const r = await one<{ id: string }>(
    db,
    `select id from statuses where category_id = $1 and label = $2 and archived_at is null`,
    [categoryId, label],
  )
  return r.id
}

function setAttendance(db: PGlite, cat: string, member: string, status: string | null, pin: string | null = null) {
  return asAnon(db, (tx) =>
    tx.query<{ session_id: string; status_id: string | null }>(`select * from set_attendance($1, $2, $3, $4)`, [
      cat,
      member,
      status,
      pin,
    ]),
  )
}

let db: PGlite
beforeEach(async () => {
  db = await createDb()
})

describe('2.1 skema', () => {
  it('menolak jam sesi yang tidak lengkap atau terbalik', async () => {
    const cat = await createCategory(db, 'Kelas A', false)
    for (const [start, end] of [['19:30', null], ['21:00', '19:30'], ['19:30', '19:30']]) {
      const err = await errorOf(
        db.query(`insert into sessions (category_id, session_date, start_time, end_time) values ($1, '2026-10-05', $2, $3)`, [
          cat.id,
          start,
          end,
        ]),
      )
      expect(err).toMatch(/sessions_time_pair/)
    }
  })

  it('menolak jenis kelamin selain L/P dan satu status per anggota per sesi', async () => {
    await orgFor(db)
    expect(
      await errorOf(
        db.query(
          `insert into members (name, gender, kelompok_id) values ('A', 'X', (select id from org_units where level = 'kelompok' limit 1))`,
        ),
      ),
    ).toMatch(/check/)
    const cat = await createCategory(db, 'Kelas A')
    const [m] = await addMembers(db, cat.id, [{ name: 'Budi', gender: 'L' }])
    const s = await one<{ id: string }>(db, `select id from sessions where category_id = $1`, [cat.id])
    const st = await statusId(db, cat.id, 'Hadir')
    await db.query(`insert into attendance (session_id, member_id, status_id) values ($1, $2, $3)`, [s.id, m.id, st])
    const err = await errorOf(
      db.query(`insert into attendance (session_id, member_id, status_id) values ($1, $2, $3)`, [s.id, m.id, st]),
    )
    expect(err).toMatch(/attendance_pkey/)
  })

  it('menghapus kategori beserta turunannya tetapi mempertahankan jamaah', async () => {
    const a = await createCategory(db, 'Kelas A')
    await createCategory(db, 'Kajian')
    const [budi] = await addMembers(db, a.id, [{ name: 'Budi', gender: 'L' }])
    await setAttendance(db, a.id, budi.id, await statusId(db, a.id, 'Hadir'))

    await asAdmin(db, (tx) => tx.query(`delete from categories where id = $1`, [a.id]))

    const left = await one<{ s: number; st: number; att: number; m: number }>(
      db,
      `select (select count(*) from sessions where category_id = $1)::int s,
              (select count(*) from statuses where category_id = $1)::int st,
              (select count(*) from attendance)::int att,
              (select count(*) from members where id = $2)::int m`,
      [a.id, budi.id],
    )
    expect(left).toEqual({ s: 0, st: 0, att: 0, m: 1 })
  })
})

describe('2.2 RLS & hak akses', () => {
  it('anon tidak bisa menulis tabel mana pun secara langsung', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const [m] = await addMembers(db, cat.id, [{ name: 'Budi', gender: 'L' }])
    const s = await one<{ id: string }>(db, `select id from sessions where category_id = $1`, [cat.id])
    const st = await statusId(db, cat.id, 'Hadir')

    const attempts = [
      `insert into categories (name, slug) values ('X', 'x')`,
      `update categories set name = 'Y'`,
      `delete from categories`,
      `insert into members (name, gender) values ('X', 'L')`,
      `insert into statuses (category_id, label, color) values ('${cat.id}', 'X', '#000000')`,
      `insert into attendance (session_id, member_id, status_id) values ('${s.id}', '${m.id}', '${st}')`,
      `update sessions set closed_at = now()`,
    ]
    for (const sql of attempts) {
      const res = await asAnon(db, async (tx) => {
        try {
          const r = await tx.query(sql)
          return r.affectedRows ?? 0
        } catch {
          return 'denied'
        }
      })
      expect([0, 'denied'], sql).toContain(res)
    }
    const counts = await one<{ c: number; a: number }>(
      db,
      `select (select count(*) from categories)::int c, (select count(*) from attendance)::int a`,
    )
    expect(counts).toEqual({ c: 1, a: 0 })
  })

  it('PIN hanya bisa dibaca admin, tidak oleh anon', async () => {
    const cat = await createCategory(db, 'Kelas A')
    await asAdmin(db, (tx) => tx.query(`select set_category_pin($1, true, '1234')`, [cat.id]))
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select pin from categories`)))).toMatch(/permission denied/)
    const pub = await asAnon(db, (tx) => tx.query<{ pin_enabled: boolean }>(`select id, name, slug, pin_enabled from categories`))
    expect(pub.rows[0].pin_enabled).toBe(true)
    const admin = await asAdmin(db, (tx) => one<{ pin: string }>(tx, `select pin from categories where id = $1`, [cat.id]))
    expect(admin.pin).toBe('1234')
  })

  it('migrasi 0005 menghapus pin_hash', async () => {
    const r = await db.query(
      `select 1 from information_schema.columns where table_name = 'categories' and column_name = 'pin_hash'`,
    )
    expect(r.rows).toHaveLength(0)
  })

  it('anon tidak bisa memanggil fungsi admin', async () => {
    const cat = await createCategory(db, 'Kelas A')
    for (const sql of [
      `select * from create_activity('X')`,
      `select end_session('${cat.id}')`,
      `select schedule_sessions('${cat.id}', '[]')`,
      `select set_category_pin('${cat.id}', false)`,
      `select import_members('[]')`,
    ]) {
      expect(await errorOf(asAnon(db, (tx) => tx.query(sql)))).toMatch(/NOT_ADMIN/)
    }
  })
})

describe('2.3 create_category & set_category_pin', () => {
  it('membuat kategori dengan 4 status bawaan dan tanpa sesi', async () => {
    const cat = await createCategory(db, 'Kelas 1A', false)
    expect(cat.slug).toBe('kelas-1a-baitul-ilmi')
    const statuses = await db.query<{ label: string; counts_as_present: boolean }>(
      `select label, counts_as_present from statuses where category_id = $1 order by sort_order`,
      [cat.id],
    )
    expect(statuses.rows).toEqual([
      { label: 'Hadir', counts_as_present: true },
      { label: 'Izin', counts_as_present: false },
      { label: 'Sakit', counts_as_present: false },
      { label: 'Alpa', counts_as_present: false },
    ])
    const sessions = await db.query(`select 1 from sessions where category_id = $1`, [cat.id])
    expect(sessions.rows).toHaveLength(0)
  })

  it('label sesi dibentuk dari tanggal dalam bahasa Indonesia', async () => {
    const r = await one<{ a: string; b: string; c: string }>(
      db,
      `select format_session_date('2026-09-26') a, format_session_date('2026-10-01') b, format_session_date('2026-03-01') c`,
    )
    expect(r).toEqual({ a: 'Sabtu, 26 September 2026', b: 'Kamis, 1 Oktober 2026', c: 'Minggu, 1 Maret 2026' })
  })

  it('menolak nama duplikat (tanpa membedakan huruf besar) dan membuat slug unik', async () => {
    await createCategory(db, 'Kelas A')
    expect(await errorOf(createCategory(db, ' kelas a '))).toMatch(/CATEGORY_NAME_TAKEN/)
    const other = await createCategory(db, 'Kelas-A')
    expect(other.slug).toBe('kelas-a-baitul-ilmi-2')
  })

  it('mengganti nama memperbarui slug', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const slug = await asAdmin(db, (tx) => one<{ s: string }>(tx, `select update_activity($1, 'Kelas 1A') s`, [cat.id]))
    expect(slug.s).toBe('kelas-1a-baitul-ilmi')
  })

  it('memvalidasi PIN tepat 4 digit dan wajib PIN saat menyalakan', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const set = (enabled: boolean, pin: string | null) =>
      asAdmin(db, (tx) => tx.query(`select set_category_pin($1, $2, $3)`, [cat.id, enabled, pin]))
    for (const bad of ['12a4', '123', '12345', '123456']) expect(await errorOf(set(true, bad))).toMatch(/PIN_FORMAT/)
    expect(await errorOf(set(true, null))).toMatch(/PIN_FORMAT/)
    await set(true, '0420')
    await set(true, null) // sudah aktif: PIN lama dipertahankan
    const on = await one<{ pin_enabled: boolean; pin: string | null }>(db, `select pin_enabled, pin from categories`)
    expect(on).toEqual({ pin_enabled: true, pin: '0420' })
    await set(false, null)
    const off = await one<{ pin_enabled: boolean; pin: string | null }>(db, `select pin_enabled, pin from categories`)
    expect(off).toEqual({ pin_enabled: false, pin: null })
  })
})

describe('2.4 verify_category_pin & set_attendance', () => {
  let cat: { id: string }
  let budi: { id: string }
  beforeEach(async () => {
    cat = await createCategory(db, 'Kelas A')
    ;[budi] = await addMembers(db, cat.id, [{ name: 'Budi', gender: 'L' }])
  })

  it('tanpa PIN: anon bisa mengisi, mengubah, dan mengembalikan ke Belum', async () => {
    const hadir = await statusId(db, cat.id, 'Hadir')
    const izin = await statusId(db, cat.id, 'Izin')
    await setAttendance(db, cat.id, budi.id, hadir)
    await setAttendance(db, cat.id, budi.id, izin)
    let rows = await db.query<{ status_id: string }>(`select status_id from attendance`)
    expect(rows.rows).toEqual([{ status_id: izin }])
    await setAttendance(db, cat.id, budi.id, null)
    rows = await db.query(`select status_id from attendance`)
    expect(rows.rows).toHaveLength(0)
  })

  it('dengan PIN: wajib, salah ditolak, benar diterima', async () => {
    await asAdmin(db, (tx) => tx.query(`select set_category_pin($1, true, '1234')`, [cat.id]))
    const hadir = await statusId(db, cat.id, 'Hadir')
    expect(await errorOf(setAttendance(db, cat.id, budi.id, hadir))).toMatch(/PIN_REQUIRED/)
    expect(await errorOf(setAttendance(db, cat.id, budi.id, hadir, '9999'))).toMatch(/PIN_INVALID/)
    await setAttendance(db, cat.id, budi.id, hadir, '1234')
    expect((await db.query(`select 1 from attendance`)).rows).toHaveLength(1)

    const verify = (pin: string) =>
      asAnon(db, (tx) => one<{ ok: boolean }>(tx, `select verify_category_pin($1, $2) ok`, [cat.id, pin]))
    expect((await verify('1234')).ok).toBe(true)
    expect((await verify('0000')).ok).toBe(false)
  })

  it('PIN lama ditolak setelah admin mengganti PIN', async () => {
    await asAdmin(db, (tx) => tx.query(`select set_category_pin($1, true, '1234')`, [cat.id]))
    await asAdmin(db, (tx) => tx.query(`select set_category_pin($1, true, '5678')`, [cat.id]))
    const hadir = await statusId(db, cat.id, 'Hadir')
    expect(await errorOf(setAttendance(db, cat.id, budi.id, hadir, '1234'))).toMatch(/PIN_INVALID/)
  })

  it('menolak status kategori lain, status terarsip, dan bukan peserta', async () => {
    const other = await createCategoryInCitra(db, 'Kajian')
    const [siti] = await addMembers(db, other.id, [{ name: 'Siti', gender: 'P' }])
    const otherHadir = await statusId(db, other.id, 'Hadir')
    expect(await errorOf(setAttendance(db, cat.id, budi.id, otherHadir))).toMatch(/INVALID_STATUS/)
    expect(await errorOf(setAttendance(db, cat.id, siti.id, await statusId(db, cat.id, 'Hadir')))).toMatch(/NOT_PARTICIPANT/)

    const izin = await statusId(db, cat.id, 'Izin')
    await db.query(`update statuses set archived_at = now() where id = $1`, [izin])
    expect(await errorOf(setAttendance(db, cat.id, budi.id, izin))).toMatch(/INVALID_STATUS/)
  })

  it('selalu menulis ke sesi aktif, tidak ke sesi yang sudah ditutup', async () => {
    const hadir = await statusId(db, cat.id, 'Hadir')
    const first = await setAttendance(db, cat.id, budi.id, hadir)
    await endAndOpen(db, cat.id)
    const second = await setAttendance(db, cat.id, budi.id, await statusId(db, cat.id, 'Izin'))
    expect(second.rows[0].session_id).not.toBe(first.rows[0].session_id)
    const old = await one<{ status_id: string }>(db, `select status_id from attendance where session_id = $1`, [
      first.rows[0].session_id,
    ])
    expect(old.status_id).toBe(hadir)
  })
})

describe('2.5 delete_status', () => {
  it('hapus permanen bila belum terpakai, arsip bila terpakai, tolak status aktif terakhir', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const [budi] = await addMembers(db, cat.id, [{ name: 'Budi', gender: 'L' }])
    const del = (id: string) => asAdmin(db, (tx) => one<{ r: string }>(tx, `select delete_status($1) r`, [id]))

    expect((await del(await statusId(db, cat.id, 'Sakit'))).r).toBe('deleted')

    const izin = await statusId(db, cat.id, 'Izin')
    await setAttendance(db, cat.id, budi.id, izin)
    expect((await del(izin)).r).toBe('archived')
    const archived = await one<{ archived: boolean }>(db, `select archived_at is not null archived from statuses where id = $1`, [izin])
    expect(archived.archived).toBe(true)

    expect((await del(await statusId(db, cat.id, 'Alpa'))).r).toBe('deleted')
    expect(await errorOf(del(await statusId(db, cat.id, 'Hadir')))).toMatch(/LAST_ACTIVE_STATUS/)
  })

  it('delete langsung status terpakai ditolak oleh foreign key', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const [budi] = await addMembers(db, cat.id, [{ name: 'Budi', gender: 'L' }])
    const hadir = await statusId(db, cat.id, 'Hadir')
    await setAttendance(db, cat.id, budi.id, hadir)
    expect(await errorOf(asAdmin(db, (tx) => tx.query(`delete from statuses where id = $1`, [hadir])))).toMatch(
      /foreign key/,
    )
  })
})

describe('2.6 akhiri sesi & sesi baru', () => {
  it('snapshot anggota, tutup sesi, buka sesi baru; kategori lain tidak berubah', async () => {
    const a = await createCategory(db, 'Kelas A')
    const b = await createCategoryInCitra(db, 'Kelas B')
    const membersA = await addMembers(db, a.id, [
      { name: 'Budi', gender: 'L' },
      { name: 'Citra', gender: 'P' },
    ])
    const [dina] = await addMembers(db, b.id, [{ name: 'Dina', gender: 'P' }])
    await setAttendance(db, a.id, membersA[0].id, await statusId(db, a.id, 'Hadir'))
    await setAttendance(db, b.id, dina.id, await statusId(db, b.id, 'Hadir'))
    const oldA = await one<{ id: string }>(db, `select id from sessions where category_id = $1`, [a.id])

    await asAdmin(db, (tx) => tx.query(`select end_session($1)`, [a.id]))
    await asAdmin(db, (tx) =>
      tx.query(`select schedule_sessions($1, '[{"date":"2026-10-03","start":"19:30","end":"21:00","note":" Pekan 1 "}]')`, [
        a.id,
      ]),
    )
    const newId = await one<{ id: string }>(db, `select id from sessions where category_id = $1 and closed_at is null`, [a.id])

    const sessions = await db.query<{ id: string; label: string; closed: boolean; note: string | null }>(
      `select id, label, closed_at is not null closed, note from sessions where category_id = $1 order by started_at, closed_at nulls last`,
      [a.id],
    )
    expect(sessions.rows).toEqual([
      { id: oldA.id, label: expect.any(String), closed: true, note: null },
      { id: newId.id, label: 'Sabtu, 3 Oktober 2026', closed: false, note: 'Pekan 1' },
    ])
    const snapshot = await db.query(`select member_id from session_members where session_id = $1`, [oldA.id])
    expect(snapshot.rows).toHaveLength(2)
    // Budi hadir; Citra belum mengisi sehingga otomatis dicatat Alpa saat reset (status otomatis bawaan).
    const oldRows = await db.query<{ label: string }>(
      `select st.label from attendance a join statuses st on st.id = a.status_id where a.session_id = $1 order by st.label`,
      [oldA.id],
    )
    expect(oldRows.rows).toEqual([{ label: 'Alpa' }, { label: 'Hadir' }])
    expect((await db.query(`select 1 from attendance where session_id = $1`, [newId.id])).rows).toHaveLength(0)

    const citra = await one<{ id: string }>(db, `select id from org_units where slug = 'citra'`)
    const summaryB = await asAnon(db, (tx) =>
      one<{ present: number }>(tx, `select present from public_kelompok_activities($1) where category_id = $2`, [citra.id, b.id]),
    )
    expect(summaryB.present).toBe(1)
  })

  it('catatan kosong menjadi null; catatan >200 karakter ditolak', async () => {
    const a = await createCategory(db, 'Kelas A', false)
    const item = (note: string) => JSON.stringify([{ date: '2026-10-05', start: '19:30', end: '21:00', note }])
    await asAdmin(db, (tx) => tx.query(`select schedule_sessions($1, $2)`, [a.id, item('  ')]))
    const s = await one<{ note: string | null }>(db, `select note from sessions where category_id = $1`, [a.id])
    expect(s.note).toBeNull()
    expect(
      await errorOf(asAdmin(db, (tx) => tx.query(`select schedule_sessions($1, $2)`, [a.id, item('x'.repeat(201))]))),
    ).toMatch(/NOTE_TOO_LONG/)
  })

  it('mengubah tanggal lewat update_session: label ikut berubah; update langsung tidak berpengaruh', async () => {
    const a = await createCategory(db, 'Kelas A', false)
    await asAdmin(db, (tx) =>
      tx.query(`select schedule_sessions($1, '[{"date":"2026-10-05","start":"19:30","end":"21:00"}]')`, [a.id]),
    )
    const s = await one<{ id: string }>(db, `select id from sessions where category_id = $1`, [a.id])
    await asAdmin(db, (tx) => tx.query(`select update_session($1, '2026-10-01', '19:30', '21:00', 0, null)`, [s.id]))
    expect((await one<{ label: string }>(db, `select label from sessions where id = $1`, [s.id])).label).toBe(
      'Kamis, 1 Oktober 2026',
    )
    const direct = await asAdmin(db, (tx) => tx.query(`update sessions set note = 'x' where id = $1`, [s.id]))
    expect(direct.affectedRows ?? 0).toBe(0)
  })
})

describe('2.7 import_members', () => {
  it('selalu membuat orang baru dan menormalkan spasi', async () => {
    const a = await createCategory(db, 'Kelas A')
    const b = await createCategoryInCitra(db, 'Kajian')
    await addMembers(db, a.id, [{ name: 'Ahmad Fauzi', gender: 'L' }])
    const rows = await addMembers(db, b.id, [{ name: '  Ahmad   Fauzi ', gender: 'L' }])
    expect(rows.map((r) => r.name)).toEqual(['Ahmad Fauzi'])
    expect((await one<{ c: number }>(db, `select count(*)::int c from members`)).c).toBe(2)
  })

  it('satu baris tidak valid membatalkan seluruh import', async () => {
    await createCategory(db, 'Kelas A')
    const err = await errorOf(
      asAdmin(db, (tx) =>
        tx.query(`select import_members($1)`, [JSON.stringify([
            { name: 'Budi', gender: 'L' },
            { name: 'Citra', gender: 'X' },
          ]),
        ]),
      ),
    )
    expect(err).toMatch(/INVALID_ROW/)
    expect((await one<{ c: number }>(db, `select count(*)::int c from members`)).c).toBe(0)
  })
})

describe('2.8 ringkasan kegiatan', () => {
  it('menghitung hadir/total keseluruhan dan per gender (77/82 L = 94%)', async () => {
    const cat = await createCategory(db, 'Kelas A')
    const rows = [
      ...Array.from({ length: 82 }, (_, i) => ({ name: `L${i}`, gender: 'L' })),
      ...Array.from({ length: 90 }, (_, i) => ({ name: `P${i}`, gender: 'P' })),
    ]
    await asAdmin(db, (tx) => tx.query(`select import_members($1)`, [JSON.stringify(rows)]))
    const hadir = await statusId(db, cat.id, 'Hadir')
    const izin = await statusId(db, cat.id, 'Izin')
    const s = await one<{ id: string }>(db, `select id from sessions where category_id = $1`, [cat.id])
    // 77 L hadir, 83 P hadir, 2 P izin (tidak dihitung), sisanya belum diisi.
    await db.query(
      `insert into attendance (session_id, member_id, status_id)
       select $1::uuid, id, $2::uuid from (select id from members where gender = 'L' order by name limit 77) x
       union all
       select $1::uuid, id, $2::uuid from (select id from members where gender = 'P' order by name limit 83) y`,
      [s.id, hadir],
    )
    await db.query(
      `insert into attendance (session_id, member_id, status_id)
       select $1::uuid, id, $2::uuid from (select id from members where gender = 'P' order by name offset 83 limit 2) z`,
      [s.id, izin],
    )
    const sum = await asAdmin(db, (tx) => one<Record<string, number>>(tx, `select total, present from activity_summary`))
    expect(sum).toEqual({ total: 172, present: 160 })
    // Per jenis kelamin (dihitung klien dari daftar peserta publik).
    const byGender = await asAnon(db, (tx) =>
      tx.query<{ gender: string; total: number; present: number }>(
        `select p.gender, count(*)::int total, count(st.id) filter (where st.counts_as_present)::int present
         from public_activity_participants($1) p
         left join attendance a on a.member_id = p.member_id and a.session_id = $2
         left join statuses st on st.id = a.status_id
         group by p.gender order by p.gender`,
        [cat.id, s.id],
      ),
    )
    expect(byGender.rows).toEqual([
      { gender: 'L', total: 82, present: 77 },
      { gender: 'P', total: 90, present: 83 },
    ])
  })

  it('kategori tanpa anggota menghasilkan 0/0', async () => {
    await createCategory(db, 'Kosong')
    const sum = await asAdmin(db, (tx) => one<{ total: number; present: number }>(tx, `select total, present from activity_summary`))
    expect(sum).toEqual({ total: 0, present: 0 })
  })
})

describe('2.9 realtime', () => {
  it('attendance dan sessions terdaftar di publication supabase_realtime', async () => {
    const r = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename`,
    )
    expect(r.rows.map((x) => x.tablename)).toEqual(['attendance', 'sessions'])
  })
})
