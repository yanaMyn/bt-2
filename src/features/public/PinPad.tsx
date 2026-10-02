import { Delete, Lock } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../../lib/errors'
import { verifyPin } from './api'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'hapus'] as const

/**
 * Gerbang PIN halaman kategori: menggantikan isi halaman sampai PIN benar.
 * PIN langsung diperiksa saat digit ke-4 ditekan, tanpa tombol OK.
 */
export function PinPad({ categoryId, onSuccess }: { categoryId: string; onSuccess: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(value: string) {
    setChecking(true)
    setError(null)
    try {
      if (await verifyPin(categoryId, value)) {
        onSuccess(value)
        return
      }
      setError('PIN salah. Coba lagi.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setChecking(false)
    }
    setPin('')
  }

  function press(key: (typeof KEYS)[number]) {
    if (checking) return
    setError(null)
    if (key === 'hapus') {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (pin.length >= PIN_LENGTH) return
    const next = pin + key
    setPin(next)
    if (next.length === PIN_LENGTH) void submit(next)
  }

  return (
    <section
      className="animate-rise mt-4 rounded-[2rem] border border-line/70 bg-white p-6 shadow-card"
      aria-label="Masukkan PIN"
    >
      <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Lock className="size-7" aria-hidden />
      </span>
      <h2 className="text-center text-xl font-extrabold tracking-tight">Masukkan PIN</h2>
      <p className="mb-5 text-center text-muted">Minta PIN 4 angka ke pengurus. Cukup sekali di HP ini.</p>
      <div className="mb-2 flex justify-center gap-4" aria-label={`${pin.length} dari ${PIN_LENGTH} digit dimasukkan`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-5 rounded-full transition ${
              i < pin.length ? 'scale-110 bg-brand-600' : 'border-2 border-slate-300'
            } ${error ? 'border-red-400' : ''}`}
          />
        ))}
      </div>
      <p className="mb-4 min-h-6 text-center font-semibold text-red-600" role="alert">
        {checking ? <span className="font-medium text-muted">Memeriksa…</span> : error}
      </p>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              disabled={checking}
              onClick={() => press(k)}
              aria-label={k === 'hapus' ? 'Hapus satu digit' : undefined}
              className={`flex h-16 items-center justify-center rounded-2xl font-bold transition active:scale-95 active:bg-brand-100 disabled:opacity-40 ${
                k === 'hapus'
                  ? 'bg-transparent text-slate-500 hover:bg-slate-100'
                  : 'bg-slate-100 text-2xl text-ink hover:bg-slate-200'
              }`}
            >
              {k === 'hapus' ? <Delete className="size-7" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </section>
  )
}
