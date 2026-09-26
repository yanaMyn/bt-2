import { describe, expect, it } from 'vitest'
import { asUser, createDb, setupOrg } from './harness'

describe('1.1 harness hierarki', () => {
  it('membuat struktur uji dengan admin per level', async () => {
    const db = await createDb()
    const org = await setupOrg(db)
    const units = await db.query<{ level: string; n: number }>(
      `select level, count(*)::int n from org_units group by level order by level`,
    )
    expect(units.rows).toEqual([
      { level: 'daerah', n: 1 },
      { level: 'desa', n: 2 },
      { level: 'kelompok', n: 3 },
    ])
    const me = await asUser(db, org.users.bi, (tx) =>
      tx.query<{ unit_level: string; unit_name: string; parent_name: string }>(
        `select unit_level, unit_name, parent_name from my_admin_profile()`,
      ),
    )
    expect(me.rows).toEqual([{ unit_level: 'kelompok', unit_name: 'Baitul Ilmi', parent_name: 'CNT' }])
  })
})
