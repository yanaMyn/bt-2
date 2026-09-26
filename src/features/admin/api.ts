import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import {
  CATEGORY_COLUMNS,
  type ActivityCriteria,
  type ActivitySummary,
  type AttendanceRow,
  type Category,
  type CriteriaMarital,
  type Gender,
  type Jamaah,
  type Marital,
  type Member,
  type OrgUnit,
  type Session,
  type Status,
} from '../../lib/types'
import type { SessionStatRow } from '../../lib/compare'
import type { HistoryRow } from '../../lib/memberHistory'
import type { ReportData } from '../../lib/reports'

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

const PAGE = 1000

/** Ambil semua baris melewati batas 1000 baris per request Supabase. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(await build(from, from + PAGE - 1))
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

// ---------- Struktur organisasi ----------

export async function listUnits(): Promise<OrgUnit[]> {
  return unwrap(await supabase.from('org_units').select('id, level, parent_id, name, slug').order('name'))
}

export async function createUnit(parentId: string, name: string): Promise<string> {
  return unwrap(await supabase.rpc('create_unit', { p_parent: parentId, p_name: name }))
}

export async function renameUnit(unitId: string, name: string): Promise<void> {
  unwrap(await supabase.rpc('rename_unit', { p_unit: unitId, p_name: name }))
}

export async function deleteUnit(unitId: string): Promise<void> {
  unwrap(await supabase.rpc('delete_unit', { p_unit: unitId }))
}

// ---------- Akun admin (Edge Function admin-accounts) ----------

export interface AdminAccount {
  user_id: string
  username: string
  display_name: string
  unit_id: string
  is_active: boolean
  must_change_password: boolean
  created_at: string
}

/** Admin unit yang boleh dikelola pemanggil (RLS) beserta akunnya sendiri. */
export async function listAdmins(): Promise<AdminAccount[]> {
  return unwrap(
    await supabase
      .from('admin_profiles')
      .select('user_id, username, display_name, unit_id, is_active, must_change_password, created_at')
      .order('username'),
  )
}

async function callAdminAccounts(body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-accounts', { body })
  if (!error) return
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'ACCOUNT_FAILED')
  }
  throw new Error('ACCOUNT_FAILED')
}

export function createAdmin(input: { unit_id: string; username: string; display_name: string; password: string }) {
  return callAdminAccounts({ action: 'create', ...input })
}

export function resetAdminPassword(userId: string, password: string) {
  return callAdminAccounts({ action: 'reset_password', user_id: userId, password })
}

export function setAdminActive(userId: string, active: boolean) {
  return callAdminAccounts({ action: 'set_active', user_id: userId, active })
}

// ---------- Kegiatan ----------

export async function listActivitySummaries(): Promise<ActivitySummary[]> {
  return unwrap(await supabase.from('activity_summary').select('*').order('name'))
}

export async function listCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select(CATEGORY_COLUMNS).order('name'))
}

export async function getCategory(id: string): Promise<Category | null> {
  return unwrap(await supabase.from('categories').select(CATEGORY_COLUMNS).eq('id', id).maybeSingle())
}

export interface ActivityInput {
  name: string
  gender: Gender | null
  minAge: number | null
  maxAge: number | null
  marital: CriteriaMarital | null
  scopeAll: boolean
  units: string[]
}

const activityArgs = (i: ActivityInput) => ({
  p_name: i.name.trim(),
  p_gender: i.gender,
  p_min_age: i.minAge,
  p_max_age: i.maxAge,
  p_marital: i.marital,
  p_scope_all: i.scopeAll,
  p_units: i.scopeAll ? [] : i.units,
})

/** Kegiatan baru milik unit admin yang sedang login. */
export async function createActivity(input: ActivityInput): Promise<{ id: string; slug: string }> {
  const rows = unwrap<{ id: string; slug: string }[]>(await supabase.rpc('create_activity', activityArgs(input)))
  return rows[0]
}

export async function updateActivity(id: string, input: ActivityInput): Promise<string> {
  return unwrap(await supabase.rpc('update_activity', { p_category_id: id, ...activityArgs(input) }))
}

/** Unit wilayah terpilih (bila scope_all = false). */
export async function listActivityUnits(categoryId: string): Promise<string[]> {
  const rows = unwrap<{ unit_id: string }[]>(
    await supabase.from('activity_units').select('unit_id').eq('category_id', categoryId),
  )
  return rows.map((r) => r.unit_id)
}

export async function deleteCategory(id: string): Promise<void> {
  unwrap(await supabase.from('categories').delete().eq('id', id))
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  unwrap(await supabase.rpc('set_category_active', { p_category_id: id, p_active: active }))
}

/** PIN kegiatan; hanya bisa dibaca admin (anon tidak punya akses kolom pin). */
export async function getCategoryPin(id: string): Promise<string | null> {
  const row = unwrap<{ pin: string | null }>(await supabase.from('categories').select('pin').eq('id', id).single())
  return row.pin
}

export async function setCategoryPin(id: string, enabled: boolean, pin: string | null): Promise<void> {
  unwrap(await supabase.rpc('set_category_pin', { p_category_id: id, p_enabled: enabled, p_pin: pin }))
}

// ---------- Templat kriteria ----------

export interface CriteriaTemplate {
  id: string
  name: string
  gender: Gender | null
  min_age: number | null
  max_age: number | null
  marital: CriteriaMarital | null
  sort_order: number
}

export async function listTemplates(): Promise<CriteriaTemplate[]> {
  return unwrap(await supabase.from('criteria_templates').select('*').order('sort_order').order('name'))
}

export async function saveTemplate(t: Omit<CriteriaTemplate, 'id'> & { id?: string }): Promise<void> {
  const { id, ...row } = t
  unwrap(
    id
      ? await supabase.from('criteria_templates').update(row).eq('id', id)
      : await supabase.from('criteria_templates').insert(row),
  )
}

export async function deleteTemplate(id: string): Promise<void> {
  unwrap(await supabase.from('criteria_templates').delete().eq('id', id))
}

// ---------- Status ----------

export async function listStatuses(categoryId: string): Promise<Status[]> {
  return unwrap(
    await supabase.from('statuses').select('*').eq('category_id', categoryId).order('sort_order').order('created_at'),
  )
}

export async function createStatus(s: Omit<Status, 'id' | 'archived_at'>): Promise<void> {
  unwrap(await supabase.from('statuses').insert(s))
}

export async function updateStatus(
  id: string,
  patch: Partial<Pick<Status, 'label' | 'color' | 'counts_as_present' | 'sort_order'>>,
): Promise<void> {
  unwrap(await supabase.from('statuses').update(patch).eq('id', id))
}

export async function deleteStatus(id: string): Promise<'deleted' | 'archived'> {
  return unwrap(await supabase.rpc('delete_status', { p_status_id: id }))
}

// ---------- Jamaah ----------

const JAMAAH_COLUMNS =
  'id, name, gender, kelompok_id, birth_date, marital_status, inactive_since, inactive_reason, created_at'

/** Semua jamaah dalam cakupan admin (RLS). */
export async function listJamaah(): Promise<Jamaah[]> {
  return fetchAll<Jamaah>((from, to) => supabase.from('members').select(JAMAAH_COLUMNS).order('name').range(from, to))
}

export interface JamaahInput {
  name: string
  gender: Gender
  birth_date: string | null
  marital_status: Marital
}

const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ')

/** Tambah jamaah ke kelompok admin (lewat import satu baris agar aturan sama). */
export async function createJamaah(input: JamaahInput): Promise<void> {
  await importJamaah([input])
}

export async function updateJamaah(id: string, input: JamaahInput): Promise<void> {
  unwrap(
    await supabase
      .from('members')
      .update({
        name: cleanName(input.name),
        gender: input.gender,
        birth_date: input.birth_date || null,
        marital_status: input.marital_status,
      })
      .eq('id', id),
  )
}

/** Import atomik ke kelompok admin yang sedang login. */
export async function importJamaah(rows: JamaahInput[]): Promise<number> {
  return unwrap(
    await supabase.rpc('import_members', {
      p_rows: rows.map((r) => ({
        name: cleanName(r.name),
        gender: r.gender,
        birth_date: r.birth_date || null,
        marital: r.marital_status,
      })),
    }),
  )
}

export async function setJamaahActive(
  ids: string[],
  active: boolean,
  since: string | null = null,
  reason: string | null = null,
): Promise<number> {
  return unwrap(
    await supabase.rpc('set_members_active', { p_ids: ids, p_active: active, p_since: since, p_reason: reason }),
  )
}

/** Hapus jamaah tanpa riwayat; yang punya riwayat dilewati. */
export async function deleteJamaah(ids: string[]): Promise<{ deleted: number; skipped: string[] }> {
  return unwrap(await supabase.rpc('delete_members', { p_ids: ids }))
}

// ---------- Perpindahan ----------

export interface Transfer {
  id: string
  member_id: string
  from_kelompok: string
  to_kelompok: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  requested_at: string
  decided_at: string | null
  member_name: string
  member_gender: Gender
  member_birth_date: string | null
  member_marital: Marital
  /** Nama tampilan admin yang melepas / memutuskan (null bila akunnya sudah dihapus). */
  requested_by_name: string | null
  decided_by_name: string | null
  /** Alasan pindah dari kelompok asal (opsional). */
  request_note: string | null
  /** Alasan penolakan dari kelompok tujuan (opsional). */
  decision_note: string | null
}

/** Lewat RPC agar kelompok tujuan ikut melihat data jamaah yang belum menjadi anggotanya. */
export async function listTransfers(): Promise<Transfer[]> {
  return unwrap(await supabase.rpc('list_transfers'))
}

export async function requestTransfer(memberId: string, toKelompok: string, note = ''): Promise<void> {
  unwrap(await supabase.rpc('request_transfer', { p_member: memberId, p_to: toKelompok, p_note: note.trim() || null }))
}

export async function cancelTransfer(id: string): Promise<void> {
  unwrap(await supabase.rpc('cancel_transfer', { p_transfer: id }))
}

/** Alasan hanya dipakai saat menolak. */
export async function decideTransfer(id: string, accept: boolean, note = ''): Promise<void> {
  unwrap(await supabase.rpc('decide_transfer', { p_transfer: id, p_accept: accept, p_note: note.trim() || null }))
}

// ---------- Peserta ----------

/** Jamaah peserta kegiatan pada tanggal tertentu (umur dihitung pada tanggal itu). */
export async function listParticipantIds(
  categoryId: string,
  on: string,
): Promise<{ member_id: string; kelompok_id: string }[]> {
  return unwrap(await supabase.rpc('activity_participants', { p_category_id: categoryId, p_on: on }))
}

// ---------- Sesi ----------

/** Status otomatis saat sesi diakhiri (null = tidak ada). Hanya bisa dibaca admin. */
export async function getResetStatusId(categoryId: string): Promise<string | null> {
  const row = unwrap<{ reset_status_id: string | null }>(
    await supabase.from('categories').select('reset_status_id').eq('id', categoryId).single(),
  )
  return row.reset_status_id
}

export async function setResetStatus(categoryId: string, statusId: string | null): Promise<void> {
  unwrap(await supabase.rpc('set_reset_status', { p_category_id: categoryId, p_status_id: statusId }))
}

export interface EndPreview {
  /** Peserta yang sudah mengisi di sesi berjalan. */
  filled: number
  /** Peserta yang belum mengisi dan akan dicatat otomatis (bila ada status otomatis). */
  unfilled: number
  autoStatus: Status | null
}

export async function endPreview(categoryId: string): Promise<EndPreview> {
  const sessionId = unwrap<string | null>(await supabase.rpc('current_session_id', { p_category_id: categoryId }))
  if (!sessionId) throw new Error('NO_ACTIVE_SESSION')
  const session = unwrap<Session>(await supabase.from('sessions').select('*').eq('id', sessionId).single())
  const [participants, attendance, statusId, statuses] = await Promise.all([
    listParticipantIds(categoryId, session.session_date),
    fetchAll<{ member_id: string }>((from, to) =>
      supabase.from('attendance').select('member_id').eq('session_id', sessionId).range(from, to),
    ),
    getResetStatusId(categoryId),
    listStatuses(categoryId),
  ])
  const filledIds = new Set(attendance.map((a) => a.member_id))
  const filled = participants.filter((p) => filledIds.has(p.member_id)).length
  return {
    filled,
    unfilled: participants.length - filled,
    autoStatus: statuses.find((s) => s.id === statusId && !s.archived_at) ?? null,
  }
}

const cleanNote = (note: string) => note.trim() || null

/** Tutup sesi berjalan; yang belum mengisi dicatat dengan status otomatis kegiatan. */
export async function endSession(categoryId: string): Promise<void> {
  unwrap(await supabase.rpc('end_session', { p_category_id: categoryId }))
}

export interface SessionInput {
  /** YYYY-MM-DD */
  date: string
  /** "HH:MM" */
  start: string
  end: string
  grace: number
  note: string
}

/** Jadwalkan 1–62 sesi sekaligus (atomik). */
export async function scheduleSessions(categoryId: string, items: SessionInput[]): Promise<number> {
  return unwrap(
    await supabase.rpc('schedule_sessions', {
      p_category_id: categoryId,
      p_items: items.map((i) => ({ ...i, note: cleanNote(i.note) })),
    }),
  )
}

/** Sesi selesai hanya boleh diubah tanggal & catatannya; jam & toleransi dikirim apa adanya. */
export async function updateSession(
  id: string,
  input: { date: string; start: string | null; end: string | null; grace: number; note: string },
): Promise<void> {
  unwrap(
    await supabase.rpc('update_session', {
      p_session_id: id,
      p_date: input.date,
      p_start: input.start,
      p_end: input.end,
      p_grace: input.grace,
      p_note: cleanNote(input.note),
    }),
  )
}

/** Hanya sesi dijadwalkan tanpa isian. */
export async function deleteSession(id: string): Promise<void> {
  unwrap(await supabase.rpc('delete_session', { p_session_id: id }))
}

/** Tutup sesi yang sudah lewat batas/tergantikan (cadangan bila pg_cron belum aktif). */
export async function finalizeDueSessions(): Promise<number> {
  return unwrap(await supabase.rpc('finalize_due_sessions'))
}

// ---------- Laporan ----------

/** Semua data sebuah kegiatan yang dibutuhkan riwayat sesi dan laporan (peserta & kelompok asal per sesi). */
export async function loadReportData(categoryId: string): Promise<ReportData> {
  const [category, statuses, sessions, participants] = await Promise.all([
    getCategory(categoryId),
    listStatuses(categoryId),
    fetchAll<Session>((from, to) =>
      supabase
        .from('sessions')
        .select('*')
        .eq('category_id', categoryId)
        .order('started_at', { ascending: false })
        .range(from, to),
    ),
    unwrap<{ session_id: string; member_id: string; kelompok_id: string; name: string; gender: Gender }[]>(
      await supabase.rpc('activity_report_participants', { p_category_id: categoryId }),
    ),
  ])
  if (!category) throw new Error('CATEGORY_NOT_FOUND')

  const ids = sessions.map((s) => s.id)
  const attendance = ids.length
    ? await fetchAll<AttendanceRow>((from, to) =>
        supabase
          .from('attendance')
          .select('session_id, member_id, status_id')
          .in('session_id', ids)
          .order('session_id')
          .order('member_id')
          .range(from, to),
      )
    : []

  const members = new Map<string, Member>()
  const membersBySession = new Map<string, string[]>()
  const kelompokBySession = new Map<string, Map<string, string>>()
  const attendanceBySession = new Map<string, Map<string, string>>()
  for (const s of sessions) {
    membersBySession.set(s.id, [])
    kelompokBySession.set(s.id, new Map())
    attendanceBySession.set(s.id, new Map())
  }
  for (const p of participants) {
    members.set(p.member_id, { id: p.member_id, name: p.name, gender: p.gender })
    membersBySession.get(p.session_id)?.push(p.member_id)
    kelompokBySession.get(p.session_id)?.set(p.member_id, p.kelompok_id)
  }
  for (const a of attendance) attendanceBySession.get(a.session_id)?.set(a.member_id, a.status_id)

  return { category, statuses, sessions, members, membersBySession, attendanceBySession, kelompokBySession }
}

/** Ringkasan sesi semua kegiatan dalam cakupan (view session_stats) untuk grafik perbandingan. */
export async function listSessionStats(): Promise<SessionStatRow[]> {
  return fetchAll<SessionStatRow>((from, to) =>
    supabase.from('session_stats').select('*').order('session_id').range(from, to),
  )
}

/** Riwayat kehadiran seorang jamaah lintas kegiatan & level. */
export async function memberHistory(memberId: string, from: string, to: string): Promise<HistoryRow[]> {
  return unwrap(await supabase.rpc('member_history', { p_member: memberId, p_from: from, p_to: to }))
}

export type { ActivityCriteria }
