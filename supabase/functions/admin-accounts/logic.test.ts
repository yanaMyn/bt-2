import { describe, expect, it } from 'vitest'
import { loginIdToEmail, parseRequest, usernameToEmail } from './logic'

describe('admin-accounts logic', () => {
  it('nama pengguna -> email sintetis; email tetap', () => {
    expect(usernameToEmail(' Ahmad.BI ')).toBe('ahmad.bi@users.absensi.local')
    expect(loginIdToEmail('ahmad.bi')).toBe('ahmad.bi@users.absensi.local')
    expect(loginIdToEmail(' Admin1@Gmail.com ')).toBe('admin1@gmail.com')
  })

  it('create: validasi nama pengguna, nama tampilan, password', () => {
    const base = { action: 'create', unit_id: 'u1', username: 'ahmad.bi', display_name: 'Pak Ahmad', password: 'rahasia123' }
    expect(parseRequest(base)).toEqual({ ok: true, value: base })
    expect(parseRequest({ ...base, username: 'Ahmad BI' })).toEqual({ ok: false, error: 'INVALID_USERNAME' })
    expect(parseRequest({ ...base, username: 'ab' })).toEqual({ ok: false, error: 'INVALID_USERNAME' })
    expect(parseRequest({ ...base, display_name: '  ' })).toEqual({ ok: false, error: 'DISPLAY_NAME_EMPTY' })
    expect(parseRequest({ ...base, password: '1234567' })).toEqual({ ok: false, error: 'PASSWORD_TOO_SHORT' })
    expect(parseRequest({ ...base, unit_id: '' })).toEqual({ ok: false, error: 'INVALID_REQUEST' })
  })

  it('reset_password & set_active', () => {
    expect(parseRequest({ action: 'reset_password', user_id: 'x', password: 'short' })).toEqual({
      ok: false,
      error: 'PASSWORD_TOO_SHORT',
    })
    expect(parseRequest({ action: 'set_active', user_id: 'x', active: false })).toEqual({
      ok: true,
      value: { action: 'set_active', user_id: 'x', active: false },
    })
    expect(parseRequest({ action: 'set_active', user_id: 'x', active: 'no' })).toEqual({ ok: false, error: 'INVALID_REQUEST' })
    expect(parseRequest({ action: 'hapus' })).toEqual({ ok: false, error: 'INVALID_REQUEST' })
    expect(parseRequest(null)).toEqual({ ok: false, error: 'INVALID_REQUEST' })
  })
})
