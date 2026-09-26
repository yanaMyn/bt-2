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
    <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" aria-label="Masukkan PIN">
      <h2 className="text-center text-xl font-bold">🔒 Masukkan PIN</h2>
      <p className="mb-4 text-center text-muted">Minta PIN 4 angka ke pengurus. Cukup sekali di HP ini.</p>
      <div className="mb-2 flex justify-center gap-4" aria-label={`${pin.length} dari ${PIN_LENGTH} digit dimasukkan`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full ${i < pin.length ? 'bg-brand-700' : 'border-2 border-gray-300'}`}
          />
        ))}
      </div>
      <p className="mb-3 min-h-6 text-center font-medium text-red-700" role="alert">
        {checking ? <span className="text-muted">Memeriksa…</span> : error}
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
              className={`h-16 rounded-2xl font-semibold transition active:scale-95 disabled:opacity-40 ${
                k === 'hapus' ? 'bg-gray-100 text-lg text-muted' : 'bg-gray-100 text-2xl text-ink'
              }`}
            >
              {k === 'hapus' ? '⌫ Hapus' : k}
            </button>
          ),
        )}
      </div>
    </section>
  )
}
