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
  session: Session
  statuses: Status[]
  members: Member[]
  /** member_id -> status_id pada sesi aktif */
  attendance: Map<string, string>
}

export async function fetchCategoryPage(slug: string): Promise<CategoryPageData | null> {
  const category = unwrap<Category | null>(
    await supabase.from('categories').select(CATEGORY_COLUMNS).eq('slug', slug).eq('is_active', true).maybeSingle(),
  )
  if (!category) return null

  const [session, statuses, memberRows] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('category_id', category.id)
      .is('closed_at', null)
      .single()
      .then((r) => unwrap<Session>(r)),
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

  const attendanceRows = unwrap<AttendanceRow[]>(
    await supabase.from('attendance').select('session_id, member_id, status_id').eq('session_id', session.id),
  )

  const members = memberRows
    .map((r) => r.member)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))

  return {
    category,
    session,
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
