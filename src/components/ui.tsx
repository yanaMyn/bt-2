import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-ink ring-1 ring-gray-300 hover:bg-gray-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-brand-700 hover:bg-brand-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm font-medium text-red-700">
      {children}
    </p>
  )
}

/**
 * Dialog konfirmasi. Bila `typeToConfirm` diisi, tombol konfirmasi baru aktif
 * setelah pengguna mengetik teks itu persis.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  typeToConfirm,
  busy = false,
  confirmDisabled = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  typeToConfirm?: string
  busy?: boolean
  /** Nonaktifkan tombol konfirmasi (mis. isian belum lengkap) tanpa menampilkan "Memproses…". */
  confirmDisabled?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  const [typed, setTyped] = useState('')
  useEffect(() => setTyped(''), [typeToConfirm])
  const ok = !typeToConfirm || typed.trim() === typeToConfirm.trim()
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="text-base">{message}</div>
        {children}
        {typeToConfirm && (
          <Field label={`Ketik "${typeToConfirm}" untuk konfirmasi`}>
            <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={!ok || busy || confirmDisabled}>
            {busy ? 'Memproses…' : confirmLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
