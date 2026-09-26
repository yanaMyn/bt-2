import { describe, expect, it } from 'vitest'
import { asAnon, createDb } from './harness'

describe('harness', () => {
  it('menerapkan semua migrasi dan menyediakan role anon', async () => {
    const db = await createDb()
    const role = await asAnon(db, (tx) => tx.query<{ r: string }>(`select auth.role() as r`))
    expect(role.rows[0].r).toBe('anon')
    const hash = await db.query<{ ok: boolean }>(
      `select extensions.crypt('1234', extensions.crypt('1234', extensions.gen_salt('bf'))) is not null as ok`,
    )
    expect(hash.rows[0].ok).toBe(true)
  })
})
