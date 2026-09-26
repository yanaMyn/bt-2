import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDb } from './harness'

describe('seed.sql', () => {
  it('berjalan tanpa error dan menghasilkan data contoh', async () => {
    const db = await createDb()
    await db.exec(readFileSync(join(import.meta.dirname, '..', 'seed.sql'), 'utf8'))
    const r = await db.query<Record<string, number>>(`
      select (select count(*) from categories)::int categories,
             (select count(*) from members)::int members,
             (select count(*) from sessions where closed_at is not null)::int closed,
             (select present from category_summary where name = 'Kelas A') present_a,
             (select total from category_summary where name = 'Kajian Ahad') total_kajian`)
    expect(r.rows[0]).toEqual({ categories: 2, members: 22, closed: 1, present_a: 6, total_kajian: 11 })
  })
})

describe('seed.sql tanggal sesi', () => {
  it('sesi tertutup bertanggal Sabtu, 29 Agustus 2026 dengan catatan', async () => {
    const db = await createDb()
    await db.exec(readFileSync(join(import.meta.dirname, '..', 'seed.sql'), 'utf8'))
    const r = await db.query<{ label: string; note: string }>(`select label, note from sessions where closed_at is not null`)
    expect(r.rows).toEqual([{ label: 'Sabtu, 29 Agustus 2026', note: 'Pertemuan akhir Agustus' }])
  })
})

describe('seed.sql keadaan sesi', () => {
  it('Kajian Ahad punya sesi dijadwalkan dan belum ada sesi berjalan', async () => {
    const db = await createDb()
    await db.exec(readFileSync(join(import.meta.dirname, '..', 'seed.sql'), 'utf8'))
    const r = await db.query<{ session_id: string | null; next: boolean }>(
      `select session_id, next_opens_at > now() next from category_summary where name = 'Kajian Ahad'`,
    )
    expect(r.rows).toEqual([{ session_id: null, next: true }])
  })
})
