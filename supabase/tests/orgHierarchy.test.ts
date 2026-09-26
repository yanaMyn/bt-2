import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addAdmin,
  addMembers,
  asAnon,
  asUser,
  createActivity,
  createDb,
  createUser,
  errorOf,
  scheduleFor,
  setupOrg,
  type Org,
} from './harness'

let db: PGlite
let org: Org

beforeEach(async () => {
  db = await createDb()
  org = await setupOrg(db)
})

const participants = async (categoryId: string, on: string) =>
  (
    await db.query<{ name: string }>(
      `select m.name from activity_participants($1, $2::date) p join members m on m.id = p.member_id order by m.name`,
      [categoryId, on],
    )
  ).rows.map((r) => r.name)

describe('1.2 skema', () => {
  it('menolak Daerah kedua, kelompok berinduk daerah, dan pengubahan induk', async () => {
    expect(
      await errorOf(db.query(`insert into org_units (level, name, slug) values ('daerah', 'Lain', 'lain')`)),
    ).toMatch(/org_units_one_daerah/)
    expect(
      await errorOf(
        db.query(`insert into org_units (level, parent_id, name, slug) values ('kelompok', $1, 'X', 'x')`, [
          org.daerah,
        ]),
      ),
    ).toMatch(/INVALID_PARENT/)
    expect(await errorOf(db.query(`update org_units set parent_id = $1 where id = $2`, [org.cnb, org.bi]))).toMatch(
      /UNIT_PARENT_IMMUTABLE/,
    )
  })

  it('menolak tanggal lahir di masa depan dan pengubahan kelompok di luar perpindahan', async () => {
    expect(
      await errorOf(
        asUser(db, org.users.bi, (tx) =>
          tx.query(`select import_members($1)`, [
            JSON.stringify([{ name: 'X', gender: 'L', birth_date: '2999-01-01' }]),
          ]),
        ),
      ),
    ).toMatch(/BIRTH_DATE_FUTURE/)
    const { Budi } = await addMembers(db, org.users.bi, [{ name: 'Budi', gender: 'L' }])
    expect(await errorOf(db.query(`update members set kelompok_id = $1 where id = $2`, [org.citra, Budi]))).toMatch(
      /USE_TRANSFER/,
    )
  })

  it('templat bawaan tersedia', async () => {
    const r = await db.query<{ name: string }>(`select name from criteria_templates order by sort_order`)
    expect(r.rows.map((x) => x.name)).toEqual([
      'Caberawit',
      'Pra Remaja',
      'Remaja',
      'Muda Mudi',
      'Dewasa L',
      'Dewasa P',
      'Bapak-bapak',
      'Ibu-ibu',
      'Lansia',
    ])
  })
})

describe('1.3 bootstrap_root_admin', () => {
  it('menolak bila Daerah sudah ada atau user tidak ditemukan', async () => {
    expect(await errorOf(db.query(`select bootstrap_root_admin('root@example.com', 'root2', 'X')`))).toMatch(
      /DAERAH_EXISTS/,
    )
    const fresh = await createDb()
    expect(await errorOf(fresh.query(`select bootstrap_root_admin('nobody@example.com', 'x.y', 'X')`))).toMatch(
      /USER_NOT_FOUND/,
    )
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select bootstrap_root_admin('a@b.c', 'abc', 'X')`)))).toMatch(
      /permission denied/,
    )
  })
})

describe('2.1 peserta terhitung', () => {
  it('batas umur inklusif pada tanggal sesi', async () => {
    await addMembers(db, org.users.bi, [
      { name: 'Enam belas tepat', gender: 'L', birth_date: '2010-10-05' },
      { name: 'Dua puluh kemarin', gender: 'P', birth_date: '2006-10-04' },
      { name: 'Lima belas', gender: 'P', birth_date: '2010-10-06' },
      { name: 'Tanpa tanggal', gender: 'L' },
    ])
    const remaja = await createActivity(db, org.users.bi, 'Remaja', { min: 16, max: 19 })
    expect(await participants(remaja, '2026-10-05')).toEqual(['Enam belas tepat'])
    const semua = await createActivity(db, org.users.bi, 'Umum')
    expect(await participants(semua, '2026-10-05')).toHaveLength(4)
  })

  it('status nikah: belum vs pernah (janda masuk Ibu-ibu)', async () => {
    await addMembers(db, org.users.bi, [
      { name: 'Ani', gender: 'P', marital: 'Menikah' },
      { name: 'Bu Sri', gender: 'P', marital: 'Janda' },
      { name: 'Cici', gender: 'P', marital: 'Belum' },
      { name: 'Pak Dedi', gender: 'L', marital: 'Menikah' },
    ])
    const ibu = await createActivity(db, org.users.bi, 'Ibu-ibu', { gender: 'P', marital: 'pernah' })
    expect(await participants(ibu, '2026-10-05')).toEqual(['Ani', 'Bu Sri'])
    const mudi = await createActivity(db, org.users.bi, 'Muda Mudi', { marital: 'belum' })
    expect(await participants(mudi, '2026-10-05')).toEqual(['Cici'])
  })

  it('nonaktif sejak tanggal', async () => {
    const { Ahmad } = await addMembers(db, org.users.bi, [{ name: 'Ahmad', gender: 'L' }])
    await asUser(db, org.users.bi, (tx) =>
      tx.query(`select set_members_active($1, false, '2026-10-12', 'meninggal')`, [[Ahmad]]),
    )
    const act = await createActivity(db, org.users.bi, 'Umum')
    expect(await participants(act, '2026-10-11')).toEqual(['Ahmad'])
    expect(await participants(act, '2026-10-12')).toEqual([])
  })

  it('wilayah kegiatan Desa dan Daerah (semua / terpilih)', async () => {
    await addMembers(db, org.users.bi, [{ name: 'Ahmad', gender: 'L' }])
    await addMembers(db, org.users.citra, [{ name: 'Citra1', gender: 'P' }])
    await addMembers(db, org.users.cib, [{ name: 'Cib1', gender: 'L' }])
    const desaAll = await createActivity(db, org.users.cnt, 'Desaan')
    expect(await participants(desaAll, '2026-10-05')).toEqual(['Ahmad', 'Citra1'])
    const desaPart = await createActivity(db, org.users.cnt, 'Desaan Citra', { scopeAll: false, units: [org.citra] })
    expect(await participants(desaPart, '2026-10-05')).toEqual(['Citra1'])
    const daerahAll = await createActivity(db, org.users.daerah, 'Pengajian Daerah')
    expect(await participants(daerahAll, '2026-10-05')).toEqual(['Ahmad', 'Cib1', 'Citra1'])
    const daerahCnb = await createActivity(db, org.users.daerah, 'Daerah CNB', { scopeAll: false, units: [org.cnb] })
    expect(await participants(daerahCnb, '2026-10-05')).toEqual(['Cib1'])
  })
})

describe('2.2 helper wewenang', () => {
  it('admin nonaktif dan user tanpa profil bukan admin', async () => {
    const inactive = await addAdmin(db, org.bi, 'mantan.bi', false)
    const noProfile = await createUser(db, 'x@example.com')
    for (const u of [inactive, noProfile]) {
      const r = await asUser(db, u, (tx) => tx.query<{ a: boolean }>(`select is_admin() a`))
      expect(r.rows[0].a).toBe(false)
      expect(await errorOf(asUser(db, u, (tx) => tx.query(`select * from create_activity('X')`)))).toMatch(/NOT_ADMIN/)
    }
  })

  it('unit_in_scope per level', async () => {
    const scope = (u: string, unit: string) =>
      asUser(db, u, async (tx) => (await tx.query<{ s: boolean }>(`select unit_in_scope($1) s`, [unit])).rows[0].s)
    expect(await scope(org.users.daerah, org.bi)).toBe(true)
    expect(await scope(org.users.cnt, org.bi)).toBe(true)
    expect(await scope(org.users.cnt, org.cib)).toBe(false)
    expect(await scope(org.users.bi, org.citra)).toBe(false)
  })
})

describe('2.3 RLS', () => {
  it('jamaah: dibaca sesuai cakupan, ditulis hanya oleh admin kelompoknya', async () => {
    const { Ahmad } = await addMembers(db, org.users.bi, [{ name: 'Ahmad', gender: 'L', birth_date: '2000-01-01' }])
    await addMembers(db, org.users.cib, [{ name: 'Cib1', gender: 'L' }])
    const names = (u: string) =>
      asUser(db, u, async (tx) =>
        (await tx.query<{ name: string }>(`select name from members order by name`)).rows.map((r) => r.name),
      )
    expect(await names(org.users.daerah)).toEqual(['Ahmad', 'Cib1'])
    expect(await names(org.users.cnt)).toEqual(['Ahmad'])
    expect(await names(org.users.citra)).toEqual([])
    for (const u of [org.users.daerah, org.users.cnt, org.users.citra]) {
      const r = await asUser(db, u, (tx) => tx.query(`update members set name = 'X' where id = $1`, [Ahmad]))
      expect(r.affectedRows ?? 0).toBe(0)
    }
    const own = await asUser(db, org.users.bi, (tx) =>
      tx.query(`update members set name = 'Ahmad F' where id = $1`, [Ahmad]),
    )
    expect(own.affectedRows).toBe(1)
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select birth_date from members`)))).toMatch(/permission denied/)
  })

  it('kegiatan: dibaca sesuai cakupan; status hanya diubah admin pemilik', async () => {
    const kel = await createActivity(db, org.users.bi, 'Kelompokan')
    await createActivity(db, org.users.cnt, 'Desaan')
    await createActivity(db, org.users.cib, 'Cibubur')
    await createActivity(db, org.users.daerah, 'Daerah')
    const seen = (u: string) =>
      asUser(db, u, async (tx) =>
        (await tx.query<{ name: string }>(`select name from activity_summary order by name`)).rows.map((r) => r.name),
      )
    expect(await seen(org.users.bi)).toEqual(['Kelompokan'])
    expect(await seen(org.users.cnt)).toEqual(['Desaan', 'Kelompokan'])
    expect(await seen(org.users.daerah)).toEqual(['Cibubur', 'Daerah', 'Desaan', 'Kelompokan'])
    const upd = await asUser(db, org.users.cnt, (tx) =>
      tx.query(`update statuses set label = 'X' where category_id = $1`, [kel]),
    )
    expect(upd.affectedRows ?? 0).toBe(0)
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select set_category_pin($1, true, '1234')`, [kel]))),
    ).toMatch(/NOT_ALLOWED/)
  })

  it('struktur & profil admin tidak bisa ditulis langsung', async () => {
    expect(
      await errorOf(
        asUser(db, org.users.daerah, (tx) => tx.query(`update org_units set name = 'X' where id = $1`, [org.cnt])),
      ),
    ).toMatch(/permission denied/)
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`update admin_profiles set is_active = false`))),
    ).toMatch(/permission denied/)
  })

  it('profil admin terlihat oleh diri sendiri dan admin di atasnya', async () => {
    const seen = (u: string) =>
      asUser(db, u, async (tx) =>
        (await tx.query<{ username: string }>(`select username from admin_profiles order by username`)).rows.map(
          (r) => r.username,
        ),
      )
    expect(await seen(org.users.cnt)).toEqual(['admin.bi', 'admin.citra', 'admin.cnt'])
    expect(await seen(org.users.bi)).toEqual(['admin.bi'])
    expect(await seen(org.users.daerah)).toEqual(['admin.cnb', 'admin.cnt', 'root'])
  })
})

describe('2.4 pengisian & sesi dengan wewenang', () => {
  it('bukan peserta ditolak; snapshot mencatat kelompok asal; Desa tidak mengelola kegiatan Kelompok', async () => {
    const m = await addMembers(db, org.users.bi, [
      { name: 'Remaja', gender: 'L', birth_date: '2009-01-01' },
      { name: 'Dewasa', gender: 'L', birth_date: '1990-01-01' },
    ])
    const act = await createActivity(db, org.users.bi, 'Remaja', { min: 16, max: 19 })
    await scheduleFor(db, org.users.bi, act)
    const hadir = (
      await db.query<{ id: string }>(`select id from statuses where category_id = $1 and label = 'Hadir'`, [act])
    ).rows[0].id
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [act, m.Remaja, hadir]))
    expect(
      await errorOf(asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [act, m.Dewasa, hadir]))),
    ).toMatch(/NOT_PARTICIPANT/)
    expect(await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select end_session($1)`, [act])))).toMatch(
      /NOT_ALLOWED/,
    )
    await asUser(db, org.users.bi, (tx) => tx.query(`select end_session($1)`, [act]))
    const snap = await db.query<{ kelompok_id: string }>(`select kelompok_id from session_members`)
    expect(snap.rows).toEqual([{ kelompok_id: org.bi }])
  })
})

describe('2.5 struktur', () => {
  it('Desa hanya mengelola kelompok desanya; hapus hanya bila kosong', async () => {
    const baru = await asUser(
      db,
      org.users.cnt,
      async (tx) => (await tx.query<{ id: string }>(`select create_unit($1, 'Baru') id`, [org.cnt])).rows[0].id,
    )
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select create_unit($1, 'X')`, [org.cnb]))),
    ).toMatch(/NOT_ALLOWED/)
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select create_unit($1, 'X')`, [org.daerah]))),
    ).toMatch(/NOT_ALLOWED/)
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select create_unit($1, 'citra')`, [org.cnt]))),
    ).toMatch(/UNIT_NAME_TAKEN/)
    expect(
      await errorOf(asUser(db, org.users.cnt, (tx) => tx.query(`select rename_unit($1, 'X')`, [org.cnt]))),
    ).toMatch(/NOT_ALLOWED/)
    await asUser(db, org.users.cnt, (tx) => tx.query(`select delete_unit($1)`, [baru]))
    await addMembers(db, org.users.bi, [{ name: 'A', gender: 'L' }])
    const err = await asUser(db, org.users.cnt, async (tx) => {
      try {
        await tx.query(`select delete_unit($1)`, [org.bi])
        return null
      } catch (e) {
        return e as { message: string; detail?: string }
      }
    })
    expect(err?.message).toBe('UNIT_NOT_EMPTY')
    expect(err?.detail).toBe('jamaah,admin')
  })
})

describe('2.6 kegiatan', () => {
  it('nama unik per unit; slug dari nama + unit; wilayah divalidasi', async () => {
    await createActivity(db, org.users.bi, 'Remaja')
    await createActivity(db, org.users.citra, 'Remaja')
    expect(await errorOf(createActivity(db, org.users.bi, 'remaja'))).toMatch(/CATEGORY_NAME_TAKEN/)
    const slugs = await db.query<{ slug: string }>(`select slug from categories order by slug`)
    expect(slugs.rows.map((r) => r.slug)).toEqual(['remaja-baitul-ilmi', 'remaja-citra'])
    expect(await errorOf(createActivity(db, org.users.cnt, 'X', { scopeAll: false, units: [org.cib] }))).toMatch(
      /INVALID_SCOPE/,
    )
    expect(await errorOf(createActivity(db, org.users.bi, 'Y', { min: 20, max: 10 }))).toMatch(/INVALID_AGE_RANGE/)
    const statuses = await db.query(`select 1 from statuses`)
    expect(statuses.rows).toHaveLength(8)
  })
})

describe('2.7 jamaah', () => {
  it('import hanya admin kelompok; hapus melewati yang punya riwayat; nonaktif ditolak saat pending pindah', async () => {
    expect(
      await errorOf(
        asUser(db, org.users.cnt, (tx) => tx.query(`select import_members('[{"name":"A","gender":"L"}]')`)),
      ),
    ).toMatch(/NOT_ALLOWED/)
    const m = await addMembers(db, org.users.bi, [
      { name: 'Baru', gender: 'L' },
      { name: 'Lama', gender: 'L' },
    ])
    const act = await createActivity(db, org.users.bi, 'Umum')
    await scheduleFor(db, org.users.bi, act)
    await asUser(db, org.users.bi, (tx) => tx.query(`select end_session($1)`, [act]))
    // Keduanya kini punya snapshot; tambahkan satu jamaah yang benar-benar baru.
    const n = await addMembers(db, org.users.bi, [{ name: 'Salah Input', gender: 'P' }])
    const res = await asUser(
      db,
      org.users.bi,
      async (tx) =>
        (
          await tx.query<{ r: { deleted: number; skipped: string[] } }>(`select delete_members($1) r`, [
            [m.Baru, n['Salah Input']],
          ])
        ).rows[0].r,
    )
    expect(res).toEqual({ deleted: 1, skipped: [m.Baru] })

    await asUser(db, org.users.bi, (tx) => tx.query(`select request_transfer($1, $2)`, [m.Lama, org.citra]))
    expect(
      await errorOf(
        asUser(db, org.users.bi, (tx) =>
          tx.query(`select set_members_active($1, false, '2026-10-01', 'lainnya')`, [[m.Lama]]),
        ),
      ),
    ).toMatch(/MEMBER_TRANSFER_PENDING/)
  })
})

describe('2.8 perpindahan', () => {
  it('pending tetap di asal; terima memindah; tolak/batal tanpa perubahan; hanya admin asal/tujuan', async () => {
    const { Budi } = await addMembers(db, org.users.bi, [{ name: 'Budi', gender: 'L' }])
    const request = () =>
      asUser(
        db,
        org.users.bi,
        async (tx) =>
          (await tx.query<{ id: string }>(`select request_transfer($1, $2) id`, [Budi, org.citra])).rows[0].id,
      )
    const kelompok = async () =>
      (await db.query<{ k: string }>(`select kelompok_id k from members where id = $1`, [Budi])).rows[0].k

    const t1 = await request()
    expect(await kelompok()).toBe(org.bi)
    expect(await errorOf(request())).toMatch(/MEMBER_TRANSFER_PENDING/)
    expect(
      await errorOf(asUser(db, org.users.cib, (tx) => tx.query(`select decide_transfer($1, true)`, [t1]))),
    ).toMatch(/TRANSFER_NOT_FOUND/)
    await asUser(db, org.users.citra, (tx) => tx.query(`select decide_transfer($1, false)`, [t1]))
    expect(await kelompok()).toBe(org.bi)

    const t2 = await request()
    await asUser(db, org.users.bi, (tx) => tx.query(`select cancel_transfer($1)`, [t2]))
    expect(await kelompok()).toBe(org.bi)

    const t3 = await request()
    await asUser(db, org.users.citra, (tx) => tx.query(`select decide_transfer($1, true)`, [t3]))
    expect(await kelompok()).toBe(org.citra)
    const log = await db.query<{ status: string }>(`select status from member_transfers order by requested_at`)
    expect(log.rows.map((r) => r.status)).toEqual(['rejected', 'cancelled', 'accepted'])
  })

  it('list_transfers memberi data jamaah ke kelompok tujuan yang belum bisa membacanya', async () => {
    const { Budi } = await addMembers(db, org.users.bi, [
      { name: 'Budi', gender: 'L', birth_date: '1990-05-12', marital: 'menikah' },
    ])
    await asUser(db, org.users.bi, (tx) => tx.query(`select request_transfer($1, $2)`, [Budi, org.citra]))
    // RLS members: kelompok tujuan belum bisa membaca Budi secara langsung.
    const direct = await asUser(db, org.users.citra, (tx) => tx.query(`select id from members where id = $1`, [Budi]))
    expect(direct.rows).toHaveLength(0)

    type Row = {
      member_name: string
      member_gender: string
      member_birth_date: string
      member_marital: string
      requested_by_name: string
    }
    const list = (user: string) =>
      asUser(
        db,
        user,
        async (tx) =>
          (
            await tx.query<Row>(
              `select member_name, member_gender, member_birth_date::text, member_marital, requested_by_name from list_transfers()`,
            )
          ).rows,
      )
    const [row] = await list(org.users.citra)
    expect(row).toMatchObject({
      member_name: 'Budi',
      member_gender: 'L',
      member_birth_date: '1990-05-12',
      member_marital: 'menikah',
    })
    expect(row.requested_by_name).toBeTruthy()
    expect(await list(org.users.bi)).toHaveLength(1)
    // Kelompok lain di desa berbeda tidak melihatnya; anon ditolak.
    expect(await list(org.users.cib)).toHaveLength(0)
    expect(await errorOf(asAnon(db, (tx) => tx.query(`select * from list_transfers()`)))).toMatch(
      /permission denied|NOT_ADMIN/,
    )
  })
})

describe('alasan perpindahan', () => {
  it('alasan lepas opsional; alasan tolak hanya disimpan saat ditolak; spasi = kosong', async () => {
    const { Budi, Ani } = await addMembers(db, org.users.bi, [
      { name: 'Budi', gender: 'L' },
      { name: 'Ani', gender: 'P' },
    ])
    type Row = { member_name: string; status: string; request_note: string | null; decision_note: string | null }
    const list = () =>
      asUser(
        db,
        org.users.citra,
        async (tx) =>
          (await tx.query<Row>(`select member_name, status, request_note, decision_note from list_transfers()`)).rows,
      )
    const request = (member: string, note?: string) =>
      asUser(
        db,
        org.users.bi,
        async (tx) =>
          (
            await tx.query<{ id: string }>(
              note === undefined ? `select request_transfer($1, $2) id` : `select request_transfer($1, $2, $3) id`,
              note === undefined ? [member, org.citra] : [member, org.citra, note],
            )
          ).rows[0].id,
      )

    const t1 = await request(Budi, '  Menikah, ikut suami  ')
    const t2 = await request(Ani)
    await asUser(db, org.users.citra, (tx) =>
      tx.query(`select decide_transfer($1, false, 'Belum ada konfirmasi')`, [t1]),
    )
    await asUser(db, org.users.citra, (tx) => tx.query(`select decide_transfer($1, true, 'diabaikan')`, [t2]))
    const byName = Object.fromEntries((await list()).map((r) => [r.member_name, r]))
    expect(byName.Budi).toMatchObject({
      status: 'rejected',
      request_note: 'Menikah, ikut suami',
      decision_note: 'Belum ada konfirmasi',
    })
    expect(byName.Ani).toMatchObject({ status: 'accepted', request_note: null, decision_note: null })

    const t3 = await request(Budi, '   ')
    await asUser(db, org.users.citra, (tx) => tx.query(`select decide_transfer($1, false, '')`, [t3]))
    const rows = (await list()).filter((r) => r.member_name === 'Budi' && r.request_note === null)
    expect(rows[0]).toMatchObject({ decision_note: null })
    expect(await errorOf(request(Budi, 'x'.repeat(501)))).toMatch(/TRANSFER_NOTE_TOO_LONG/)
  })
})

describe('3.1 publik', () => {
  it('halaman kelompok hanya berisi kegiatan yang mencakup kelompok, dengan hitungan per kelompok', async () => {
    const bi = await addMembers(db, org.users.bi, [
      { name: 'A', gender: 'L' },
      { name: 'B', gender: 'L' },
    ])
    await addMembers(db, org.users.citra, [{ name: 'C', gender: 'P' }])
    const own = await createActivity(db, org.users.bi, 'Kelompokan')
    const desa = await createActivity(db, org.users.cnt, 'Desaan')
    await createActivity(db, org.users.cnt, 'Khusus Citra', { scopeAll: false, units: [org.citra] })
    await createActivity(db, org.users.daerah, 'Daerah')
    await createActivity(db, org.users.cib, 'Cibubur')
    await scheduleFor(db, org.users.cnt, desa)
    const hadir = (
      await db.query<{ id: string }>(`select id from statuses where category_id = $1 and label = 'Hadir'`, [desa])
    ).rows[0].id
    await asAnon(db, (tx) => tx.query(`select set_attendance($1, $2, $3)`, [desa, bi.A, hadir]))

    const r = await asAnon(db, (tx) =>
      tx.query<{ name: string; owner_level: string; present: number; total: number }>(
        `select name, owner_level, present, total from public_kelompok_activities($1) order by name`,
        [org.bi],
      ),
    )
    expect(r.rows).toEqual([
      { name: 'Daerah', owner_level: 'daerah', present: 0, total: 0 },
      { name: 'Desaan', owner_level: 'desa', present: 1, total: 2 },
      { name: 'Kelompokan', owner_level: 'kelompok', present: 0, total: 0 },
    ])
    expect(own).toBeTruthy()

    const p = await asAnon(db, (tx) =>
      tx.query<Record<string, unknown>>(`select * from public_activity_participants($1)`, [desa]),
    )
    expect(p.rows).toHaveLength(3)
    expect(Object.keys(p.rows[0]).sort()).toEqual(['gender', 'kelompok_id', 'kelompok_name', 'member_id', 'name'])
  })
})

describe('3.2 laporan', () => {
  it('riwayat jamaah lintas level setelah pindah; admin di luar cakupan ditolak', async () => {
    const { Budi } = await addMembers(db, org.users.bi, [{ name: 'Budi', gender: 'L' }])
    const kel = await createActivity(db, org.users.bi, 'Kelompokan')
    const desa = await createActivity(db, org.users.cnt, 'Desaan')
    for (const [u, a] of [
      [org.users.bi, kel],
      [org.users.cnt, desa],
    ] as const) {
      await scheduleFor(db, u, a, { dayOffset: -2, start: '19:30', end: '21:00' })
    }
    await db.query(`select finalize_due_sessions()`)
    const t = await asUser(
      db,
      org.users.bi,
      async (tx) =>
        (await tx.query<{ id: string }>(`select request_transfer($1, $2) id`, [Budi, org.citra])).rows[0].id,
    )
    await asUser(db, org.users.citra, (tx) => tx.query(`select decide_transfer($1, true)`, [t]))

    const h = await asUser(db, org.users.cnt, (tx) =>
      tx.query<{ category_name: string; owner_level: string; kelompok_name: string; status_label: string }>(
        `select category_name, owner_level, kelompok_name, status_label from member_history($1, today_jakarta() - 7, today_jakarta())
         order by category_name`,
        [Budi],
      ),
    )
    expect(h.rows).toEqual([
      { category_name: 'Desaan', owner_level: 'desa', kelompok_name: 'Baitul Ilmi', status_label: 'Alpa' },
      { category_name: 'Kelompokan', owner_level: 'kelompok', kelompok_name: 'Baitul Ilmi', status_label: 'Alpa' },
    ])
    expect(
      await errorOf(
        asUser(db, org.users.cib, (tx) =>
          tx.query(`select * from member_history($1, '2000-01-01', '2100-01-01')`, [Budi]),
        ),
      ),
    ).toMatch(/NOT_ALLOWED/)
  })
})
