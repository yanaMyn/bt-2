import type { ReactNode } from 'react'

export function PublicHeader({
  title,
  subtitle,
  note,
  left,
}: {
  title: string
  subtitle?: string
  note?: string | null
  left?: ReactNode
}) {
  return (
    <header className="bg-brand-700 text-white">
      <div className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-5">
        {left}
        <h1 className="text-2xl leading-tight font-bold break-words">{title}</h1>
        {subtitle && <p className="mt-0.5 text-brand-100">{subtitle}</p>}
        {note && <p className="mt-1 text-sm break-words text-brand-50/90">📝 {note}</p>}
      </div>
    </header>
  )
}
