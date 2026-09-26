import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import { errorMessage } from '../../lib/errors'
import { MIN_PASSWORD, USERNAME_RE } from '../../../supabase/functions/admin-accounts/logic'
import { createAdmin, listAdmins, resetAdminPassword, setAdminActive, type AdminAccount } from './api'
import { useProfile } from './profile'
import { useUnits } from './units'

/** Daerah mengelola admin Desa; Desa mengelola admin Kelompok di desanya. */
export function AdminsPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: admins = [], isPending, error } = useQuery({ queryKey: ['admin', 'accounts'], queryFn: listAdmins })
  const { data: units = [] } = useUnits()
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [resetting, setResetting] = useState<AdminAccount | null>(null)
  const [toggling, setToggling] = useState<AdminAccount | null>(null)
  const [credential, setCredential] = useState<{ title: string; username: string; password: string } | null>(null)

  const toggle = useMutation({
    mutationFn: (a: AdminAccount) => setAdminActive(a.user_id, !a.is_active),
    onSuccess: (_r, a) => {
      setToggling(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'accounts'] })
      toast({ message: `Akun ${a.username} ${a.is_active ? 'dinonaktifkan' : 'diaktifkan'}` })
    },
  })

  if (profile.unit_level === 'kelompok') return <p className="text-muted">Akun admin dikelola admin Desa dan Daerah.</p>
  const childUnits = childrenOf(units, profile.unit_id)
  const noun = profile.unit_level === 'daerah' ? 'Desa' : 'Kelompok'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Admin {noun}</h1>
        <p className="text-muted">
          Akun login admin tiap {noun.toLowerCase()}. Password sementara wajib diganti saat login pertama. Satu{' '}
          {noun.toLowerCase()} boleh punya beberapa admin.
        </p>
      </div>
      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {!isPending && childUnits.length === 0 && (
        <p className="text-muted">Belum ada {noun}. Tambahkan dulu di menu Struktur.</p>
      )}

      {childUnits.map((u) => {
        const list = admins.filter((a) => a.unit_id === u.id)
        return (
          <Card key={u.id} className="flex flex-col gap-2 p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 pt-3 pb-2">
              <span className="font-bold">
                {noun} {u.name}
              </span>
              <Button variant="secondary" onClick={() => setCreatingFor(u.id)}>
                + Admin
              </Button>
            </div>
            <ul className="divide-y divide-gray-100">
              {list.length === 0 && <li className="px-4 pb-3 text-muted">Belum ada admin.</li>}
              {list.map((a) => (
                <li key={a.user_id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">
                      {a.display_name} <span className="text-muted">@{a.username}</span>
                    </span>
                    <span className="text-sm">
                      {!a.is_active ? (
                        <span className="font-medium text-red-700">Nonaktif</span>
                      ) : a.must_change_password ? (
                        <span className="text-yellow-800">Belum ganti password sementara</span>
                      ) : (
                        <span className="text-green-800">Aktif</span>
                      )}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => setResetting(a)}>
                    Reset password
                  </Button>
                  <Button variant="ghost" className={a.is_active ? 'text-red-700' : ''} onClick={() => setToggling(a)}>
                    {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}

      {creatingFor && (
        <CreateAdminSheet
          unitId={creatingFor}
          unitName={`${noun} ${units.find((u) => u.id === creatingFor)?.name ?? ''}`}
          onClose={() => setCreatingFor(null)}
          onDone={(username, password) => {
            setCreatingFor(null)
            void qc.invalidateQueries({ queryKey: ['admin', 'accounts'] })
            setCredential({ title: 'Akun dibuat', username, password })
          }}
        />
      )}
      {resetting && (
        <ResetPasswordSheet
          admin={resetting}
          onClose={() => setResetting(null)}
          onDone={(password) => {
            setResetting(null)
            void qc.invalidateQueries({ queryKey: ['admin', 'accounts'] })
            setCredential({ title: 'Password direset', username: resetting.username, password })
          }}
        />
      )}
      {credential && (
        <BottomSheet title={credential.title} onClose={() => setCredential(null)}>
          <div className="flex flex-col gap-4">
            <p>Sampaikan kepada admin yang bersangkutan. Password ini tidak ditampilkan lagi.</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-4 text-lg">
              <dt className="text-muted">Nama pengguna</dt>
              <dd className="font-mono font-bold break-all">{credential.username}</dd>
              <dt className="text-muted">Password</dt>
              <dd className="font-mono font-bold break-all">{credential.password}</dd>
            </dl>
            <Button onClick={() => setCredential(null)}>Selesai</Button>
          </div>
        </BottomSheet>
      )}
      {toggling && (
        <ConfirmDialog
          title={`${toggling.is_active ? 'Nonaktifkan' : 'Aktifkan'} akun ${toggling.username}?`}
          message={
            toggling.is_active
              ? 'Akun tidak bisa login sampai diaktifkan kembali. Data yang sudah dibuat tetap ada.'
              : 'Akun bisa login kembali dengan password terakhirnya.'
          }
          confirmLabel={toggling.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          danger={toggling.is_active}
          busy={toggle.isPending}
          error={toggle.error && errorMessage(toggle.error)}
          onConfirm={() => toggle.mutate(toggling)}
          onClose={() => {
            setToggling(null)
            toggle.reset()
          }}
        />
      )}
    </div>
  )
}

/** Password sementara acak 10 karakter tanpa huruf yang mirip (l/1, O/0). */
function randomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Password sementara" hint={`Minimal ${MIN_PASSWORD} karakter. Wajib diganti saat login pertama.`}>
      <div className="flex gap-2">
        <input className={`${inputClass} font-mono`} value={value} onChange={(e) => onChange(e.target.value)} />
        <Button variant="secondary" onClick={() => onChange(randomPassword())}>
          Acak
        </Button>
      </div>
    </Field>
  )
}

function CreateAdminSheet({
  unitId,
  unitName,
  onClose,
  onDone,
}: {
  unitId: string
  unitName: string
  onClose: () => void
  onDone: (username: string, password: string) => void
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(randomPassword)
  const uname = username.trim().toLowerCase()
  const unameOk = USERNAME_RE.test(uname)
  const save = useMutation({
    mutationFn: () => createAdmin({ unit_id: unitId, username: uname, display_name: displayName.trim(), password }),
    onSuccess: () => onDone(uname, password),
  })
  const valid = unameOk && displayName.trim() && password.length >= MIN_PASSWORD
  return (
    <BottomSheet title="Admin baru" subtitle={unitName} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save.mutate()
        }}
      >
        <Field
          label="Nama pengguna"
          hint="3–32 karakter: huruf kecil, angka, titik, atau garis bawah. Contoh: admin.citra"
        >
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>
        {username && !unameOk && <ErrorText>Nama pengguna tidak sesuai aturan.</ErrorText>}
        <Field label="Nama tampilan">
          <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </Field>
        <PasswordField value={password} onChange={setPassword} />
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!valid || save.isPending}>
          {save.isPending ? 'Membuat akun…' : 'Buat akun'}
        </Button>
      </form>
    </BottomSheet>
  )
}

function ResetPasswordSheet({
  admin,
  onClose,
  onDone,
}: {
  admin: AdminAccount
  onClose: () => void
  onDone: (password: string) => void
}) {
  const [password, setPassword] = useState(randomPassword)
  const save = useMutation({
    mutationFn: () => resetAdminPassword(admin.user_id, password),
    onSuccess: () => onDone(password),
  })
  return (
    <BottomSheet title={`Reset password ${admin.username}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <PasswordField value={password} onChange={setPassword} />
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button onClick={() => save.mutate()} disabled={password.length < MIN_PASSWORD || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Reset password'}
        </Button>
      </div>
    </BottomSheet>
  )
}
