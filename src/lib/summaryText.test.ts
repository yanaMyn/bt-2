import { describe, expect, it } from 'vitest'
import { summarySessionText } from './summaryText'
import type { CategorySummary } from './types'

const base = {
  session_id: null,
  session_label: null,
  session_start_time: null,
  session_end_time: null,
  next_opens_at: null,
  next_session_label: null,
} as unknown as CategorySummary

describe('summarySessionText', () => {
  it('berjalan', () => {
    expect(
      summarySessionText({
        ...base,
        session_id: 's',
        session_label: 'Senin, 5 Oktober 2026',
        session_start_time: '19:30:00',
        session_end_time: '21:00:00',
      }),
    ).toBe('Senin, 5 Oktober 2026 · 19.30–21.00')
  })
  it('menunggu sesi berikutnya', () => {
    expect(
      summarySessionText({
        ...base,
        next_opens_at: '2026-10-08T12:30:00Z',
        next_session_label: 'Kamis, 8 Oktober 2026',
      }),
    ).toBe('Absen dibuka Kamis, 8 Oktober 2026 pukul 19.30')
  })
  it('tanpa jadwal', () => {
    expect(summarySessionText(base)).toBe('Belum ada jadwal sesi')
  })
})
