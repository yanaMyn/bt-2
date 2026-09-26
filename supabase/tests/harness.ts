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
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
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
/**
 * Admin untuk test lama: admin Kelompok Baitul Ilmi pada struktur uji standar
 * (dibuat otomatis saat pertama dipakai untuk db tersebut).
 */
export async function asAdmin<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const org = await orgFor(db)
  return asUser(db, org.users.bi, fn)
}

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

// ---------------------------------------------------------------------------
// Hierarki organisasi (add-org-hierarchy)
// ---------------------------------------------------------------------------

/** Jalankan fn sebagai user Auth tertentu (role authenticated, claim sub). */
export async function asUser<T>(db: PGlite, userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ role: 'authenticated', sub: userId }),
    ])
    await tx.exec(`set local role authenticated`)
    return fn(tx)
  })
}

export async function createUser(db: PGlite, email: string): Promise<string> {
  return (await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id
}

/** Buat akun admin untuk sebuah unit langsung di database (pengganti Edge Function dalam test). */
export async function addAdmin(db: PGlite, unitId: string, username: string, active = true): Promise<string> {
  const id = await createUser(db, `${username}@users.absensi.local`)
  await db.query(
    `insert into admin_profiles (user_id, username, display_name, unit_id, is_active, must_change_password)
     values ($1, $2, $2, $3, $4, false)`,
    [id, username, unitId, active],
  )
  return id
}

export interface Org {
  daerah: string
  cnt: string
  cnb: string
  /** Kelompok Baitul Ilmi & Citra (Desa CNT), Cibubur (Desa CNB) */
  bi: string
  citra: string
  cib: string
  users: { daerah: string; cnt: string; cnb: string; bi: string; citra: string; cib: string }
}

/**
 * Struktur uji standar: Daerah Uji > (Desa CNT > Baitul Ilmi, Citra), (Desa CNB > Cibubur),
 * masing-masing dengan satu admin aktif.
 */
const orgs = new WeakMap<PGlite, Promise<Org>>()

/** Struktur uji standar untuk db ini (dibuat sekali). */
export function orgFor(db: PGlite): Promise<Org> {
  let org = orgs.get(db)
  if (!org) {
    org = buildOrg(db)
    orgs.set(db, org)
  }
  return org
}

export function setupOrg(db: PGlite): Promise<Org> {
  return orgFor(db)
}

async function buildOrg(db: PGlite): Promise<Org> {
  const rootUser = await createUser(db, 'root@example.com')
  const daerah = (await db.query<{ id: string }>(`select bootstrap_root_admin('root@example.com', 'root', 'Daerah Uji') id`))
    .rows[0].id
  const unit = async (parent: string, name: string) =>
    asUser(db, rootUser, async (tx) => (await tx.query<{ id: string }>(`select create_unit($1, $2) id`, [parent, name])).rows[0].id)
  const cnt = await unit(daerah, 'CNT')
  const cnb = await unit(daerah, 'CNB')
  const bi = await unit(cnt, 'Baitul Ilmi')
  const citra = await unit(cnt, 'Citra')
  const cib = await unit(cnb, 'Cibubur')
  return {
    daerah,
    cnt,
    cnb,
    bi,
    citra,
    cib,
    users: {
      daerah: rootUser,
      cnt: await addAdmin(db, cnt, 'admin.cnt'),
      cnb: await addAdmin(db, cnb, 'admin.cnb'),
      bi: await addAdmin(db, bi, 'admin.bi'),
      citra: await addAdmin(db, citra, 'admin.citra'),
      cib: await addAdmin(db, cib, 'admin.cib'),
    },
  }
}

export interface MemberInput {
  name: string
  gender: 'L' | 'P'
  birth_date?: string | null
  marital?: string | null
}

/** Import jamaah ke kelompok milik admin `userId`; mengembalikan map nama -> id. */
export async function addMembers(db: PGlite, userId: string, rows: MemberInput[]): Promise<Record<string, string>> {
  await asUser(db, userId, (tx) => tx.query(`select import_members($1)`, [JSON.stringify(rows)]))
  const names = rows.map((r) => r.name)
  const r = await db.query<{ id: string; name: string }>(`select id, name from members where name = any($1)`, [names])
  return Object.fromEntries(r.rows.map((x) => [x.name, x.id]))
}

export interface ActivityInput {
  gender?: 'L' | 'P' | null
  min?: number | null
  max?: number | null
  marital?: 'belum' | 'pernah' | null
  scopeAll?: boolean
  units?: string[]
}

/** Buat kegiatan milik unit admin `userId`; mengembalikan id. */
export async function createActivity(db: PGlite, userId: string, name: string, c: ActivityInput = {}): Promise<string> {
  return asUser(db, userId, async (tx) =>
    (
      await tx.query<{ id: string }>(`select id from create_activity($1, $2, $3, $4, $5, $6, $7)`, [
        name,
        c.gender ?? null,
        c.min ?? null,
        c.max ?? null,
        c.marital ?? null,
        c.scopeAll ?? true,
        c.units ?? [],
      ])
    ).rows[0].id,
  )
}

/** Jadwalkan sesi (relatif hari ini WIB) untuk kegiatan sebagai admin pemiliknya. */
export async function scheduleFor(
  db: PGlite,
  userId: string,
  categoryId: string,
  opts: { dayOffset?: number; start?: string; end?: string; grace?: number; note?: string | null } = {},
): Promise<string> {
  const { dayOffset = 0, start = '00:00', end = '23:59:59', grace = 0, note = null } = opts
  return asUser(db, userId, async (tx) => {
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
