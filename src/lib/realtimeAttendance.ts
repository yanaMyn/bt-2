/** Event perubahan `attendance` dari Supabase Realtime (hanya kolom yang dipakai). */
export interface AttendanceEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Partial<{ session_id: string; member_id: string; status_id: string }>
  /** Untuk DELETE hanya berisi kunci primer (session_id, member_id). */
  old: Partial<{ session_id: string; member_id: string }>
}

/**
 * Terapkan satu event isian ke peta `member_id -> status_id` sesi yang sedang tampil.
 * Mengembalikan peta baru bila berubah, atau peta yang sama bila event tidak relevan.
 */
export function applyAttendanceChange(
  map: Map<string, string>,
  event: AttendanceEvent,
  sessionId: string,
): Map<string, string> {
  if (event.eventType === 'DELETE') {
    const { session_id, member_id } = event.old
    if (session_id !== sessionId || !member_id || !map.has(member_id)) return map
    const next = new Map(map)
    next.delete(member_id)
    return next
  }
  const { session_id, member_id, status_id } = event.new
  if (session_id !== sessionId || !member_id || !status_id || map.get(member_id) === status_id) return map
  const next = new Map(map)
  next.set(member_id, status_id)
  return next
}
