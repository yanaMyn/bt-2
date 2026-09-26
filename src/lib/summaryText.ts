import { formatTimeRange, opensText } from './sessionTime'
import type { CategorySummary } from './types'

/** Keterangan sesi untuk kartu kategori (beranda & admin). */
export function summarySessionText(c: CategorySummary): string {
  if (c.session_id) {
    const range = formatTimeRange(c.session_start_time, c.session_end_time)
    return range ? `${c.session_label} · ${range}` : (c.session_label ?? '')
  }
  if (c.next_opens_at && c.next_session_label) return opensText(c.next_session_label, c.next_opens_at)
  return 'Belum ada jadwal sesi'
}
