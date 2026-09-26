import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')

/**
 * Stub minimal lingkungan Supabase: role anon/authenticated, schema auth dengan
 * auth.role()/auth.uid() yang membaca request.jwt.claims, schema extensions,
 * grant default seperti Supabase, dan publication supabase_realtime.
 */
export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  grant usage on schema extensions to anon, authenticated;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::json->>'role'
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid
  $$;

  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;

  create publication supabase_realtime;
`

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export async function createDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(SUPABASE_STUB)
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

export type Role = 'anon' | 'authenticated'

/** Jalankan fn sebagai role Supabase tertentu (RLS berlaku), lalu rollback atau commit. */
export async function asRole<T>(
  db: PGlite,
  role: Role,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role })])
    await tx.exec(`set local role ${role}`)
    return fn(tx)
  })
}

export const asAnon = <T>(db: PGlite, fn: (tx: Transaction) => Promise<T>) => asRole(db, 'anon', fn)
export const asAdmin = <T>(db: PGlite, fn: (tx: Transaction) => Promise<T>) =>
  asRole(db, 'authenticated', fn)

/** Ambil pesan error dari promise yang diharapkan gagal. */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('Expected promise to reject')
}

/**
 * Jadwalkan sesi berjam relatif terhadap hari ini (WIB) sebagai admin. dayOffset 0 = hari ini.
 * Default 00:00–23:59:59 sehingga sesi hari ini sedang berjalan kapan pun test dijalankan.
 */
export async function scheduleSession(
  db: PGlite,
  categoryId: string,
  opts: { dayOffset?: number; start?: string; end?: string; grace?: number; note?: string | null } = {},
): Promise<string> {
  const { dayOffset = 0, start = '00:00', end = '23:59:59', grace = 0, note = null } = opts
  return asAdmin(db, async (tx) => {
    await tx.query(
      `select schedule_sessions($1, jsonb_build_array(jsonb_build_object(
         'date', today_jakarta() + $2::int, 'start', $3::text, 'end', $4::text, 'grace', $5::int, 'note', $6::text)))`,
      [categoryId, dayOffset, start, end, grace, note],
    )
    const r = await tx.query<{ id: string }>(
      `select id from sessions where category_id = $1 order by started_at desc, opens_at desc nulls last limit 1`,
      [categoryId],
    )
    return r.rows[0].id
  })
}

/** Akhiri sesi berjalan lalu buka sesi baru hari ini (pengganti reset_category lama untuk test). */
export async function endAndOpen(db: PGlite, categoryId: string, note: string | null = null): Promise<string> {
  await asAdmin(db, (tx) => tx.query(`select end_session($1)`, [categoryId]))
  return scheduleSession(db, categoryId, { note })
}
