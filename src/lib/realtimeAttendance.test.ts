import { describe, expect, it } from 'vitest'
import { applyAttendanceChange, type AttendanceEvent } from './realtimeAttendance'

const base = new Map([['budi', 'hadir']])
const ev = (e: Partial<AttendanceEvent> & Pick<AttendanceEvent, 'eventType'>): AttendanceEvent => ({
  new: {},
  old: {},
  ...e,
})

describe('applyAttendanceChange', () => {
  it('INSERT dan UPDATE mengisi status tanpa mengubah peta asli', () => {
    const a = applyAttendanceChange(
      base,
      ev({ eventType: 'INSERT', new: { session_id: 's1', member_id: 'ani', status_id: 'izin' } }),
      's1',
    )
    expect(Object.fromEntries(a)).toEqual({ budi: 'hadir', ani: 'izin' })
    const b = applyAttendanceChange(
      a,
      ev({ eventType: 'UPDATE', new: { session_id: 's1', member_id: 'budi', status_id: 'sakit' } }),
      's1',
    )
    expect(b.get('budi')).toBe('sakit')
    expect(Object.fromEntries(base)).toEqual({ budi: 'hadir' })
  })

  it('DELETE memakai old untuk menghapus', () => {
    const a = applyAttendanceChange(
      base,
      ev({ eventType: 'DELETE', old: { session_id: 's1', member_id: 'budi' } }),
      's1',
    )
    expect(a.has('budi')).toBe(false)
  })

  it('event sesi lain atau tanpa perubahan mengembalikan peta yang sama', () => {
    expect(
      applyAttendanceChange(
        base,
        ev({ eventType: 'INSERT', new: { session_id: 's2', member_id: 'ani', status_id: 'x' } }),
        's1',
      ),
    ).toBe(base)
    expect(
      applyAttendanceChange(base, ev({ eventType: 'DELETE', old: { session_id: 's2', member_id: 'budi' } }), 's1'),
    ).toBe(base)
    expect(
      applyAttendanceChange(
        base,
        ev({ eventType: 'UPDATE', new: { session_id: 's1', member_id: 'budi', status_id: 'hadir' } }),
        's1',
      ),
    ).toBe(base)
    expect(
      applyAttendanceChange(base, ev({ eventType: 'DELETE', old: { session_id: 's1', member_id: 'ani' } }), 's1'),
    ).toBe(base)
  })
})
