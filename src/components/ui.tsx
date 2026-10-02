import type { LucideIcon } from 'lucide-react'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BottomSheet } from './BottomSheet'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-brand hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-line bg-white text-ink shadow-xs hover:border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white shadow-[0_8px_20px_-6px_rgb(220_38_38/0.45)] hover:bg-red-700',
  ghost: 'text-brand-700 hover:bg-brand-50',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
}

/** Kelas tombol, juga untuk <Link> yang tampil sebagai tombol. */
export function buttonClass(variant: Variant = 'primary', className = ''): string {
  return `inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />
}

export const inputClass =
  'min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink shadow-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const padding = /(^|\s)p-\d/.test(className) ? '' : 'p-5'
  return (
    <div className={`rounded-3xl border border-line/70 bg-white shadow-card ${padding} ${className}`}>{children}</div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {children}
    </p>
  )
}

/** Judul halaman admin: tautan kembali opsional, judul, keterangan, dan tombol aksi. */
export function PageHeader({
  title,
  description,
  back,
  actions,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <header className="animate-rise flex flex-col gap-3">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 inline-flex min-h-10 w-fit items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-sm font-semibold text-brand-700">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight break-words text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Keadaan kosong yang ramah: ikon, judul, keterangan, dan aksi opsional. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <span className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

type Tone = 'brand' | 'neutral' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Titik "sedang berlangsung" yang berdenyut. */
export function LiveDot() {
  return (
    <span className="relative flex size-2.5" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
    </span>
  )
}

/** Pilihan bertab (segmented control). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 rounded-2xl bg-slate-200/60 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition ${
            value === o.value ? 'bg-white text-ink shadow-card' : 'text-slate-600 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Pil filter yang bisa digeser horizontal. */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] ${
            value === o.value
              ? 'bg-ink text-white shadow-float'
              : 'border border-line bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Inisial nama untuk avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function Avatar({
  name,
  tone = 'brand',
  size = 'md',
}: {
  name: string
  tone?: 'brand' | 'L' | 'P'
  size?: 'md' | 'lg'
}) {
  const color =
    tone === 'L'
      ? 'bg-sky-100 text-sky-800'
      : tone === 'P'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-brand-100 text-brand-800'
  const dim = size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm'
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${color} ${dim}`} aria-hidden>
      {initials(name) || '?'}
    </span>
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
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
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
