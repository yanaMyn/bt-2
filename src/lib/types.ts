import type { Gender } from './stats'

export type { Gender }

export type UnitLevel = 'daerah' | 'desa' | 'kelompok'
export type Marital = 'belum' | 'menikah' | 'janda_duda'
export type CriteriaMarital = 'belum' | 'pernah'

export interface OrgUnit {
  id: string
  level: UnitLevel
  parent_id: string | null
  name: string
  slug: string
}

/** Kriteria peserta kegiatan (null = tanpa batasan). */
export interface ActivityCriteria {
  criteria_gender: Gender | null
  criteria_min_age: number | null
  criteria_max_age: number | null
  criteria_marital: CriteriaMarital | null
}

/** Kegiatan (tabel categories). */
export interface Category extends ActivityCriteria {
  id: string
  name: string
  slug: string
  pin_enabled: boolean
  is_active: boolean
  created_at: string
  owner_unit_id: string
  scope_all: boolean
}

/** Kolom kegiatan yang boleh dibaca klien publik (pin tidak pernah dipilih). */
export const CATEGORY_COLUMNS =
  'id, name, slug, pin_enabled, is_active, created_at, owner_unit_id, scope_all, criteria_gender, criteria_min_age, criteria_max_age, criteria_marital'

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

/** Jamaah lengkap (hanya terbaca admin dalam cakupan). */
export interface Jamaah extends Member {
  kelompok_id: string
  birth_date: string | null
  marital_status: Marital
  inactive_since: string | null
  inactive_reason: 'meninggal' | 'pindah_luar' | 'lainnya' | null
  created_at: string
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

/** Kartu kegiatan (ringkasan sesi berjalan & berikutnya). */
export interface ActivityCard {
  category_id: string
  name: string
  slug: string
  pin_enabled: boolean
  owner_level: UnitLevel
  owner_name: string
  session_id: string | null
  session_label: string | null
  session_note?: string | null
  session_start_time: string | null
  session_end_time: string | null
  session_closes_at: string | null
  next_opens_at: string | null
  next_session_label: string | null
  present: number
  total: number
}

/** Baris view activity_summary (admin, dalam cakupan). */
export interface ActivitySummary extends ActivityCard, ActivityCriteria {
  is_active: boolean
  owner_unit_id: string
  scope_all: boolean
}

export interface AttendanceRow {
  session_id: string
  member_id: string
  status_id: string
}
