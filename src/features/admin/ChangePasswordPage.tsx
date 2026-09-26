import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, ErrorText, Field, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { MIN_PASSWORD } from '../../../supabase/functions/admin-accounts/logic'
import { useProfile } from './profile'

export function ChangePasswordPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD) return setError(`Password minimal ${MIN_PASSWORD} karakter.`)
    if (password !== confirm) return setError('Konfirmasi password tidak sama.')
    setBusy(true)
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) {
      setBusy(false)
      return setError(
        updErr.code === 'same_password'
          ? 'Password baru harus berbeda dari password sebelumnya.'
          : 'Gagal mengganti password. Coba lagi.',
      )
    }
    const { error: rpcErr } = await supabase.rpc('password_changed')
    setBusy(false)
    if (rpcErr) return setError('Password sudah diganti, tetapi status akun gagal diperbarui. Coba lagi.')
    await qc.invalidateQueries({ queryKey: ['admin', 'me'] })
    navigate('/admin', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-700">Ganti password</h1>
      <p className="mb-6 text-muted">
        {profile.must_change_password
          ? 'Anda masuk dengan password sementara. Buat password baru sebelum melanjutkan.'
          : 'Buat password baru untuk akun Anda.'}
      </p>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Password baru" hint={`Minimal ${MIN_PASSWORD} karakter.`}>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Ulangi password baru">
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan password'}
          </Button>
          {!profile.must_change_password && (
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={busy}>
              Batal
            </Button>
          )}
        </form>
      </Card>
    </main>
  )
}
