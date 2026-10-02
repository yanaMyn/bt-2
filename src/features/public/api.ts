import { supabase } from '../../lib/supabase'
import {
  type ActivityCard,
  type AttendanceRow,
  type Category,
  type Member,
  type OrgUnit,
  type Session,
  type Status,
} from '../../lib/types'

function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Seluruh Desa & Kelompok (tanpa data pribadi) untuk pemilihan di beranda. */
export async function fetchStructure(): Promise<OrgUnit[]> {
  return unwrap(await supabase.rpc('public_structure'))
}

/** Kegiatan aktif yang mengikutkan kelompok ini; hadir/total dihitung untuk peserta kelompok ini saja. */
export async function fetchKelompokActivities(kelompokId: string): Promise<ActivityCard[]> {
  const rows = unwrap<ActivityCard[]>(await supabase.rpc('public_kelompok_activities', { p_kelompok: kelompokId }))
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
}

export interface Participant extends Member {
  kelompok_id: string
  kelompok_name: string
}

export interface CategoryPageData {
  category: Category
  /** Sesi berjalan menurut server; null bila tidak ada. */
  session: Session | null
  /** Sesi dijadwalkan terdekat (untuk "Absen dibuka …"). */
  next: Session | null
  statuses: Status[]
  /** Peserta sesi berjalan (kosong bila tidak ada sesi). */
  members: Participant[]
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
  // Lewat RPC agar admin yang sedang login tetap melihat kegiatan di luar cakupannya (sama seperti publik).
  const category = unwrap<Category[]>(await supabase.rpc('public_category', { p_slug: slug }))[0] ?? null
  if (!category) return null

  const [session, next, statuses, members] = await Promise.all([
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
    supabase.rpc('public_activity_participants', { p_category_id: category.id }).then((r) =>
      unwrap<
        { member_id: string; name: string; gender: Member['gender']; kelompok_id: string; kelompok_name: string }[]
      >(r).map((p): Participant => ({
        id: p.member_id,
        name: p.name,
        gender: p.gender,
        kelompok_id: p.kelompok_id,
        kelompok_name: p.kelompok_name,
      })),
    ),
  ])

  const attendanceRows = session
    ? unwrap<AttendanceRow[]>(
        await supabase.from('attendance').select('session_id, member_id, status_id').eq('session_id', session.id),
      )
    : []

  members.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))

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
