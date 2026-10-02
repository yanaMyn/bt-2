import type { ReactNode } from 'react'

/** Header hero halaman publik dengan gradasi brand. */
export function PublicHeader({
  title,
  subtitle,
  note,
  left,
  eyebrow,
  children,
}: {
  title: string
  subtitle?: ReactNode
  note?: string | null
  left?: ReactNode
  eyebrow?: ReactNode
  /** Konten tambahan di bawah judul (mis. filter). */
  children?: ReactNode
}) {
  return (
    <header className="hero-bg relative overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
        {left && <div className="mb-3">{left}</div>}
        {eyebrow && <p className="mb-1 text-sm font-semibold tracking-wide text-brand-100/90 uppercase">{eyebrow}</p>}
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-brand-50/90">{subtitle}</p>}
        {note && (
          <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-sm break-words text-white/95 ring-1 ring-white/15">
            📝 {note}
          </p>
        )}
        {children}
      </div>
    </header>
  )
}

/** Tombol kembali berbentuk pil untuk di atas header publik. */
export const heroBackClass =
  'inline-flex min-h-11 items-center gap-1 rounded-full bg-white/12 py-1 pr-4 pl-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20'
