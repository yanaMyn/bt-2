import type { Gender } from './stats'

export type { Gender }

export interface Category {
  id: string
  name: string
  slug: string
  pin_enabled: boolean
  is_active: boolean
  created_at: string
}

/** Kolom kategori yang boleh dibaca klien publik (pin tidak pernah dipilih). */
export const CATEGORY_COLUMNS = 'id, name, slug, pin_enabled, is_active, created_at'

export interface Status {
  id: string
  category_id: string
  label: string
  color: string
  sort_order: number
  counts_as_present: boolean
  archived_at: string | null
}

export interface Member {
  id: string
  name: string
  gender: Gender
}

export interface Session {
  id: string
  category_id: string
  /** Dibentuk server dari session_date, mis. "Sabtu, 26 September 2026". */
  label: string
  /** YYYY-MM-DD */
  session_date: string
  note: string | null
  /** "HH:MM:SS" (WIB); null untuk sesi lama tanpa jam. */
  start_time: string | null
  end_time: string | null
  /** 0, 6, 12, atau 24 */
  grace_hours: number
  /** Jam buka & batas pengisian (jam selesai + toleransi); null untuk sesi lama tanpa jam. */
  opens_at: string | null
  closes_at: string | null
  started_at: string
  closed_at: string | null
}

export interface CategorySummary {
  category_id: string
  name: string
  slug: string
  pin_enabled: boolean
  /** null bila kategori tidak memiliki sesi berjalan. */
  session_id: string | null
  session_label: string | null
  total: number
  present: number
  total_l: number
  present_l: number
  total_p: number
  present_p: number
  is_active: boolean
  session_date: string | null
  session_note: string | null
  session_start_time: string | null
  session_end_time: string | null
  session_grace_hours: number | null
  session_closes_at: string | null
  /** Jam buka & label sesi dijadwalkan terdekat (bila ada). */
  next_opens_at: string | null
  next_session_label: string | null
}

export interface AttendanceRow {
  session_id: string
  member_id: string
  status_id: string
}
