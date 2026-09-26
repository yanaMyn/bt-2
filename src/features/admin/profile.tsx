import { useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { supabase } from '../../lib/supabase'

export type UnitLevel = 'daerah' | 'desa' | 'kelompok'

export interface AdminProfile {
  user_id: string
  username: string
  display_name: string
  must_change_password: boolean
  unit_id: string
  unit_level: UnitLevel
  unit_name: string
  parent_id: string | null
  parent_name: string | null
}

export const LEVEL_LABEL: Record<UnitLevel, string> = { daerah: 'Daerah', desa: 'Desa', kelompok: 'Kelompok' }

/** Profil admin yang sedang login (null = bukan admin aktif). */
export async function fetchMyProfile(): Promise<AdminProfile | null> {
  const { data, error } = await supabase.rpc('my_admin_profile')
  if (error) throw error
  return ((data as AdminProfile[] | null) ?? [])[0] ?? null
}

export function useMyProfileQuery(enabled: boolean) {
  return useQuery({ queryKey: ['admin', 'me'], queryFn: fetchMyProfile, enabled, staleTime: 60_000 })
}

const ProfileContext = createContext<AdminProfile | null>(null)
export const ProfileProvider = ProfileContext.Provider

/** Profil admin di dalam area /admin (selalu ada setelah RequireAdmin). */
export function useProfile(): AdminProfile {
  const p = useContext(ProfileContext)
  if (!p) throw new Error('useProfile dipakai di luar RequireAdmin')
  return p
}
