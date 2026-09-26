import { useQuery } from '@tanstack/react-query'
import { listUnits } from './api'

/** Semua unit organisasi (baca publik), di-cache di panel admin. */
export function useUnits() {
  return useQuery({ queryKey: ['admin', 'units'], queryFn: listUnits, staleTime: 60_000 })
}
