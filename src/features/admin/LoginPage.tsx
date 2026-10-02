import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button, ErrorText, Field, inputClass } from '../../components/ui'
import { clearAdminCache } from '../../lib/authCache'
import { supabase } from '../../lib/supabase'
import { loginIdToEmail } from '../../../supabase/functions/admin-accounts/logic'
import { useAuthSession } from './auth'
import { AuthShell, PasswordInput } from './AuthShell'

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
    <AuthShell
      title="Masuk Admin"
      description="Khusus pengurus absensi"
      footer={
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-white/90 hover:text-white">
          <ChevronLeft className="size-5" aria-hidden /> Kembali ke beranda
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nama pengguna">
          <input
            className={inputClass}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="mis. admin.citra"
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="mt-1 w-full">
          {busy ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>
    </AuthShell>
  )
}
