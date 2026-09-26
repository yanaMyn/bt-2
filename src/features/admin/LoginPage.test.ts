import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from './LoginPage'

describe('loginErrorMessage', () => {
  it('memetakan kode error Supabase Auth', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe('Email atau password salah')
    expect(loginErrorMessage({ code: 'email_provider_disabled', status: 422 })).toMatch(/Login email dimatikan/)
    expect(loginErrorMessage({ code: 'email_not_confirmed', status: 400 })).toMatch(/belum dikonfirmasi/)
    expect(loginErrorMessage({ status: 500 })).toMatch(/Gagal masuk/)
  })
})
