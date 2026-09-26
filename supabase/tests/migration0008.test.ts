import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { describe, expect, it } from 'vitest'
import { migrationFiles, SUPABASE_STUB } from './harness'

const DIR = join(import.meta.dirname, '..', 'migrations')

describe('migrasi 0008 pada sesi berlabel bebas', () => {
  it('mengisi tanggal dari waktu mulai (WIB) dan memindah label non-bawaan ke catatan', async () => {
    const db = new PGlite({ extensions: { pgcrypto } })
    await db.exec(SUPABASE_STUB)
    const files = migrationFiles()
    for (const f of files.filter((f) => f < '20260926000008')) await db.exec(readFileSync(join(DIR, f), 'utf8'))

    await db.exec(`
      insert into categories (id, name, slug) values ('00000000-0000-0000-0000-000000000001', 'Kelas', 'kelas');
      insert into sessions (category_id, label, started_at, closed_at) values
        ('00000000-0000-0000-0000-000000000001', 'September 2026', '2026-09-05T02:00:00Z', '2026-09-12T02:00:00Z'),
        ('00000000-0000-0000-0000-000000000001', 'Pekan 2 (tafsir)', '2026-09-12T17:30:00Z', null);`)

    for (const f of files.filter((f) => f >= '20260926000008')) await db.exec(readFileSync(join(DIR, f), 'utf8'))

    const r = await db.query(`select to_char(session_date, 'YYYY-MM-DD') d, label, note from sessions order by started_at`)
    expect(r.rows).toEqual([
      { d: '2026-09-05', label: 'Sabtu, 5 September 2026', note: null },
      // 12 Sep 17:30 UTC = 13 Sep 00:30 WIB
      { d: '2026-09-13', label: 'Minggu, 13 September 2026', note: 'Pekan 2 (tafsir)' },
    ])
  })
})
