import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import type { Category } from '../../lib/types'
import { deleteCategory, getCategoryPin, renameCategory, setCategoryActive, setCategoryPin } from './api'

export function CategorySettingsTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  const [name, setName] = useState(category.name)
  const rename = useMutation({
    mutationFn: () => renameCategory(category.id, name),
    onSuccess: () => {
      refresh()
      toast({ message: 'Nama kategori disimpan' })
    },
  })

  const pinKey = ['admin', 'category-pin', category.id]
  const {
    data: currentPin,
    isError: pinLoadFailed,
    isPending: pinLoading,
  } = useQuery({
    queryKey: pinKey,
    queryFn: () => getCategoryPin(category.id),
    enabled: category.pin_enabled,
  })
  const [showPin, setShowPin] = useState(false)
  const [pinOn, setPinOn] = useState(category.pin_enabled)

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => setCategoryActive(category.id, active),
    onSuccess: (_r, active) => {
      refresh()
      toast({
        message: active ? `${category.name} ditampilkan di halaman orang tua` : `${category.name} disembunyikan`,
      })
    },
  })
  const [pin, setPinValue] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const savePin = useMutation({
    mutationFn: () => setCategoryPin(category.id, pinOn, pinOn && pin ? pin : null),
    onSuccess: () => {
      setPinValue('')
      refresh()
      void qc.invalidateQueries({ queryKey: pinKey })
      toast({ message: pinOn ? 'PIN disimpan' : 'PIN dimatikan' })
    },
    onError: (e) => setPinError(errorMessage(e)),
  })

  function onSavePin(e: FormEvent) {
    e.preventDefault()
    setPinError(null)
    if (pinOn && (pin || !category.pin_enabled) && !/^[0-9]{4}$/.test(pin)) {
      setPinError('PIN harus 4 digit angka.')
      return
    }
    savePin.mutate()
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useMutation({
    mutationFn: () => deleteCategory(category.id),
    onSuccess: () => {
      refresh()
      toast({ message: `Kategori ${category.name} dihapus` })
      navigate('/admin/kategori', { replace: true })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">Kategori aktif</p>
            <p className="text-sm text-muted">
              Bila nonaktif, kategori tersembunyi dari halaman orang tua. Anggota, status, dan riwayat tetap tersimpan.
            </p>
          </div>
          <Switch
            checked={category.is_active}
            label="Kategori aktif"
            disabled={toggleActive.isPending}
            onChange={() => toggleActive.mutate(!category.is_active)}
          />
        </div>
        <ErrorText>{toggleActive.error && errorMessage(toggleActive.error)}</ErrorText>
      </Card>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            rename.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Nama kategori" hint="Alamat halaman publik ikut berubah mengikuti nama.">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <ErrorText>{rename.error && errorMessage(rename.error)}</ErrorText>
          <Button type="submit" disabled={!name.trim() || name.trim() === category.name || rename.isPending}>
            Simpan nama
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={onSavePin} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">PIN kategori</p>
              <p className="text-sm text-muted">
                Bila aktif, orang tua perlu memasukkan PIN sekali di HP-nya sebelum mengisi kehadiran.
              </p>
            </div>
            <Switch
              checked={pinOn}
              label="PIN aktif"
              onChange={() => {
                setPinOn(!pinOn)
                setPinError(null)
              }}
            />
          </div>
          {category.pin_enabled && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
              <span>
                <span className="block text-sm text-muted">PIN saat ini</span>
                {!showPin ? (
                  <span className="font-mono text-2xl tracking-[0.3em]">••••</span>
                ) : pinLoading ? (
                  <span className="text-muted">Memuat…</span>
                ) : pinLoadFailed ? (
                  <span className="text-sm text-red-700" role="alert">
                    PIN tidak bisa dimuat. Pastikan semua migrasi database sudah dijalankan.
                  </span>
                ) : currentPin ? (
                  <span className="font-mono text-2xl tracking-[0.3em]" aria-live="polite">
                    {currentPin}
                  </span>
                ) : (
                  <span className="text-sm text-muted">PIN lama tidak bisa ditampilkan. Isi PIN baru di bawah.</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                aria-pressed={showPin}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-gray-200"
              >
                {showPin ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )}
          {pinOn && (
            <Field
              label={category.pin_enabled ? 'Ganti PIN (kosongkan bila tidak diganti)' : 'PIN baru'}
              hint="4 digit angka. Bagikan ke orang tua lewat grup."
            >
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
          )}
          <ErrorText>{pinError}</ErrorText>
          <Button type="submit" disabled={savePin.isPending || (pinOn === category.pin_enabled && (!pinOn || !pin))}>
            Simpan pengaturan PIN
          </Button>
        </form>
      </Card>

      <Card className="ring-red-200">
        <p className="font-bold text-red-700">Hapus kategori</p>
        <p className="mb-3 text-sm text-muted">
          Menghapus kategori beserta status, sesi, dan seluruh catatan kehadirannya. Data orang yang juga tergabung di
          kategori lain tetap ada.
        </p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Hapus kategori…
        </Button>
      </Card>

      {confirmDelete && (
        <ConfirmDialog
          title="Hapus kategori?"
          message={
            <>
              Kategori <b>{category.name}</b> dan seluruh riwayat kehadirannya akan dihapus permanen.
            </>
          }
          typeToConfirm={category.name}
          confirmLabel="Hapus permanen"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

function Switch({
  checked,
  label,
  disabled = false,
  onChange,
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`}
      />
    </button>
  )
}
