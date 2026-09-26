import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button, ErrorText, Field, inputClass } from '../../components/ui'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { loginIdToEmail } from '../../../supabase/functions/admin-accounts/logic'
import { useAuthSession } from './auth'

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: 'Nama pengguna atau password salah',
  user_banned: 'Akun dinonaktifkan. Hubungi admin di atas Anda.',
  email_not_confirmed: 'Email admin belum dikonfirmasi. Konfirmasi user ini di Supabase (Authentication → Users).',
  email_provider_disabled:
    'Login email dimatikan di Supabase. Nyalakan provider Email di Authentication → Sign In / Providers.',
  over_request_rate_limit: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
}

export function loginErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code && LOGIN_ERRORS[error.code]) return LOGIN_ERRORS[error.code]
  if (error.status === 400) return LOGIN_ERRORS.invalid_credentials
  return 'Gagal masuk. Periksa koneksi lalu coba lagi.'
}

export function LoginPage() {
  const session = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/admin'
  if (session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(loginId), password })
    setBusy(false)
    if (error) {
      setError(loginErrorMessage(error))
      return
    }
    clearAdminCache(qc)
    navigate(from, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-700">Masuk Admin</h1>
      <p className="mb-6 text-muted">Khusus pengelola absensi.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <Field label="Nama pengguna">
          <input
            className={inputClass}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>
      <Link to="/" className="mt-6 text-center text-brand-700">
        ‹ Kembali ke beranda
      </Link>
    </main>
  )
}
