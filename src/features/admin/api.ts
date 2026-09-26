import { supabase } from '../../lib/supabase'
import {
  CATEGORY_COLUMNS,
  type AttendanceRow,
  type Category,
  type CategorySummary,
  type Gender,
  type Member,
  type Session,
  type Status,
} from '../../lib/types'
import type { SessionStatRow } from '../../lib/compare'
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

// ---------- Kategori ----------

export async function listCategorySummaries(): Promise<CategorySummary[]> {
  return unwrap(await supabase.from('category_summary').select('*').order('name'))
}

export async function listCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select(CATEGORY_COLUMNS).order('name'))
}

export async function getCategory(id: string): Promise<Category | null> {
  return unwrap(await supabase.from('categories').select(CATEGORY_COLUMNS).eq('id', id).maybeSingle())
}

export async function createCategory(name: string): Promise<{ id: string; slug: string }> {
  const rows = unwrap<{ id: string; slug: string }[]>(await supabase.rpc('create_category', { p_name: name }))
  return rows[0]
}

export async function renameCategory(id: string, name: string): Promise<string> {
  return unwrap(await supabase.rpc('rename_category', { p_category_id: id, p_name: name }))
}

export async function deleteCategory(id: string): Promise<void> {
  unwrap(await supabase.from('categories').delete().eq('id', id))
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  unwrap(await supabase.rpc('set_category_active', { p_category_id: id, p_active: active }))
}

/** PIN kategori; hanya bisa dibaca admin (anon tidak punya akses kolom pin). */
export async function getCategoryPin(id: string): Promise<string | null> {
  const row = unwrap<{ pin: string | null }>(await supabase.from('categories').select('pin').eq('id', id).single())
  return row.pin
}

export async function setCategoryPin(id: string, enabled: boolean, pin: string | null): Promise<void> {
  unwrap(await supabase.rpc('set_category_pin', { p_category_id: id, p_enabled: enabled, p_pin: pin }))
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

// ---------- Anggota ----------

export interface MemberWithCategories extends Member {
  category_ids: string[]
}

export async function listMembers(): Promise<MemberWithCategories[]> {
  const rows = await fetchAll<Member & { category_members: { category_id: string }[] }>((from, to) =>
    supabase.from('members').select('id, name, gender, category_members(category_id)').order('name').range(from, to),
  )
  return rows.map(({ category_members, ...m }) => ({ ...m, category_ids: category_members.map((c) => c.category_id) }))
}

export async function listCategoryMembers(categoryId: string): Promise<Member[]> {
  const rows = await fetchAll<{ member: Member }>(
    (from, to) =>
      supabase
        .from('category_members')
        .select('member:members(id, name, gender)')
        .eq('category_id', categoryId)
        .range(from, to) as never,
  )
  return rows.map((r) => r.member).sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

export async function updateMember(id: string, patch: { name: string; gender: Gender }): Promise<void> {
  unwrap(
    await supabase
      .from('members')
      .update({ name: patch.name.trim().replace(/\s+/g, ' '), gender: patch.gender })
      .eq('id', id),
  )
}

export async function memberHistoryCount(id: string): Promise<number> {
  const res = await supabase.from('attendance').select('member_id', { count: 'exact', head: true }).eq('member_id', id)
  if (res.error) throw res.error
  return res.count ?? 0
}

export async function deleteMember(id: string): Promise<void> {
  unwrap(await supabase.from('members').delete().eq('id', id))
}

export async function addMemberToCategory(categoryId: string, memberId: string): Promise<void> {
  unwrap(await supabase.from('category_members').insert({ category_id: categoryId, member_id: memberId }))
}

export async function removeMemberFromCategory(categoryId: string, memberId: string): Promise<void> {
  unwrap(await supabase.from('category_members').delete().eq('category_id', categoryId).eq('member_id', memberId))
}

/** Membuat orang baru dan (atomik) menjadikannya anggota kategori. */
export async function importMembers(categoryId: string, rows: { name: string; gender: Gender }[]): Promise<number> {
  return unwrap(await supabase.rpc('import_members', { p_category_id: categoryId, p_rows: rows }))
}

// ---------- Sesi ----------

export async function activeSessionAttendanceCount(categoryId: string): Promise<number> {
  const session = unwrap<Session>(
    await supabase.from('sessions').select('*').eq('category_id', categoryId).is('closed_at', null).single(),
  )
  const res = await supabase
    .from('attendance')
    .select('member_id', { count: 'exact', head: true })
    .eq('session_id', session.id)
  if (res.error) throw res.error
  return res.count ?? 0
}

const cleanNote = (note: string) => note.trim() || null

/** Tutup sesi aktif dan buka sesi baru bertanggal sessionDate (YYYY-MM-DD). */
export async function resetCategory(categoryId: string, sessionDate: string, note: string): Promise<string> {
  return unwrap(
    await supabase.rpc('reset_category', { p_category_id: categoryId, p_date: sessionDate, p_note: cleanNote(note) }),
  )
}

/** Label sesi ikut berubah karena dibentuk server dari tanggal. */
export async function updateSession(id: string, sessionDate: string, note: string): Promise<void> {
  unwrap(
    await supabase
      .from('sessions')
      .update({ session_date: sessionDate, note: cleanNote(note) })
      .eq('id', id),
  )
}

/** Semua data sebuah kategori yang dibutuhkan riwayat sesi dan laporan. */
export async function loadReportData(categoryId: string): Promise<ReportData> {
  const [category, statuses, sessions, currentMembers] = await Promise.all([
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
    listCategoryMembers(categoryId),
  ])
  if (!category) throw new Error('CATEGORY_NOT_FOUND')

  const closedIds = sessions.filter((s) => s.closed_at).map((s) => s.id)
  const allIds = sessions.map((s) => s.id)

  const [snapshots, attendance] = await Promise.all([
    closedIds.length
      ? fetchAll<{ session_id: string; member: Member }>(
          (from, to) =>
            supabase
              .from('session_members')
              .select('session_id, member:members(id, name, gender)')
              .in('session_id', closedIds)
              .order('session_id')
              .order('member_id')
              .range(from, to) as never,
        )
      : Promise.resolve([]),
    allIds.length
      ? fetchAll<AttendanceRow>((from, to) =>
          supabase
            .from('attendance')
            .select('session_id, member_id, status_id')
            .in('session_id', allIds)
            .order('session_id')
            .order('member_id')
            .range(from, to),
        )
      : Promise.resolve([]),
  ])

  const members = new Map<string, Member>()
  const membersBySession = new Map<string, string[]>()
  for (const m of currentMembers) members.set(m.id, m)
  for (const s of sessions) membersBySession.set(s.id, s.closed_at ? [] : currentMembers.map((m) => m.id))
  for (const row of snapshots) {
    members.set(row.member.id, row.member)
    membersBySession.get(row.session_id)!.push(row.member.id)
  }

  const attendanceBySession = new Map<string, Map<string, string>>()
  for (const s of sessions) attendanceBySession.set(s.id, new Map())
  const missing = new Set<string>()
  for (const a of attendance) {
    attendanceBySession.get(a.session_id)!.set(a.member_id, a.status_id)
    if (!members.has(a.member_id)) missing.add(a.member_id)
  }
  // Catatan anggota sesi aktif yang sudah dikeluarkan: tetap butuh nama untuk konteks.
  if (missing.size) {
    const extra = unwrap<Member[]>(
      await supabase
        .from('members')
        .select('id, name, gender')
        .in('id', [...missing]),
    )
    for (const m of extra) members.set(m.id, m)
  }

  return { category, statuses, sessions, members, membersBySession, attendanceBySession }
}

/** Ringkasan semua sesi semua kategori (view session_stats) untuk grafik perbandingan. */
export async function listSessionStats(): Promise<SessionStatRow[]> {
  return fetchAll<SessionStatRow>((from, to) =>
    supabase.from('session_stats').select('*').order('session_id').range(from, to),
  )
}
