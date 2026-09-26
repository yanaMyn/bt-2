import { supabase } from '../../lib/supabase'
import {
  CATEGORY_COLUMNS,
  type AttendanceRow,
  type Category,
  type CategorySummary,
  type Member,
  type Session,
  type Status,
} from '../../lib/types'

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export async function fetchSummaries(): Promise<CategorySummary[]> {
  return unwrap(await supabase.from('category_summary').select('*').eq('is_active', true).order('name'))
}

export interface CategoryPageData {
  category: Category
  /** Sesi berjalan menurut server; null bila tidak ada. */
  session: Session | null
  /** Sesi dijadwalkan terdekat (untuk "Absen dibuka …"). */
  next: Session | null
  statuses: Status[]
  members: Member[]
  /** member_id -> status_id pada sesi aktif */
  attendance: Map<string, string>
}

/** Sesi berjalan ditentukan server dari waktu (dibuka, belum lewat batas, terbaru). */
export async function currentSession(categoryId: string): Promise<Session | null> {
  const id = unwrap<string | null>(await supabase.rpc('current_session_id', { p_category_id: categoryId }))
  if (!id) return null
  return unwrap<Session | null>(await supabase.from('sessions').select('*').eq('id', id).maybeSingle())
}

export async function fetchCategoryPage(slug: string): Promise<CategoryPageData | null> {
  const category = unwrap<Category | null>(
    await supabase.from('categories').select(CATEGORY_COLUMNS).eq('slug', slug).eq('is_active', true).maybeSingle(),
  )
  if (!category) return null

  const [session, next, statuses, memberRows] = await Promise.all([
    currentSession(category.id),
    supabase
      .from('sessions')
      .select('*')
      .eq('category_id', category.id)
      .is('closed_at', null)
      .gt('opens_at', new Date().toISOString())
      .order('opens_at')
      .limit(1)
      .maybeSingle()
      .then((r) => unwrap<Session | null>(r)),
    supabase
      .from('statuses')
      .select('*')
      .eq('category_id', category.id)
      .order('sort_order')
      .order('created_at')
      .then((r) => unwrap<Status[]>(r)),
    supabase
      .from('category_members')
      .select('member:members(id, name, gender)')
      .eq('category_id', category.id)
      .then((r) => unwrap<{ member: Member }[]>(r as never)),
  ])

  const attendanceRows = session
    ? unwrap<AttendanceRow[]>(
        await supabase.from('attendance').select('session_id, member_id, status_id').eq('session_id', session.id),
      )
    : []

  const members = memberRows
    .map((r) => r.member)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))

  return {
    category,
    session,
    next,
    statuses,
    members,
    attendance: new Map(attendanceRows.map((a) => [a.member_id, a.status_id])),
  }
}

export async function verifyPin(categoryId: string, pin: string): Promise<boolean> {
  return unwrap<boolean>(await supabase.rpc('verify_category_pin', { p_category_id: categoryId, p_pin: pin }))
}

export async function setAttendance(args: {
  categoryId: string
  memberId: string
  statusId: string | null
  pin: string | null
}): Promise<void> {
  const res = await supabase.rpc('set_attendance', {
    p_category_id: args.categoryId,
    p_member_id: args.memberId,
    p_status_id: args.statusId,
    p_pin: args.pin,
  })
  if (res.error) throw res.error
}
