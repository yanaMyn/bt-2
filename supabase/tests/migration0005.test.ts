import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { describe, expect, it } from 'vitest'
import { migrationFiles, SUPABASE_STUB } from './harness'

const DIR = join(import.meta.dirname, '..', 'migrations')

describe('migrasi 0005 pada database yang sudah berisi PIN hash', () => {
  it('mematikan PIN lama dan mempertahankan kategori tanpa PIN', async () => {
    const db = new PGlite({ extensions: { pgcrypto } })
    // Stub yang sama dengan harness, lalu migrasi sebelum 0005 saja.
    await db.exec(SUPABASE_STUB)
    const files = migrationFiles()
    const before = files.filter((f) => f < '20260926000005')
    for (const f of before) await db.exec(readFileSync(join(DIR, f), 'utf8'))

    await db.exec(`
      insert into categories (name, slug, pin_enabled, pin_hash)
        values ('Kajian', 'kajian', true, extensions.crypt('123456', extensions.gen_salt('bf'))),
               ('Kelas', 'kelas', false, null);`)

    for (const f of files.filter((f) => f.startsWith('20260926000005'))) await db.exec(readFileSync(join(DIR, f), 'utf8'))

    const r = await db.query(`select slug, pin_enabled, pin from categories order by slug`)
    expect(r.rows).toEqual([
      { slug: 'kajian', pin_enabled: false, pin: null },
      { slug: 'kelas', pin_enabled: false, pin: null },
    ])
  })
})
