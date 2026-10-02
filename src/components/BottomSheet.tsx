import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Lembar dari bawah di HP; dialog di tengah pada layar lebar. */
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Tutup"
        className="animate-fade-in absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="animate-sheet-up relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-[2rem] sm:px-7 sm:pt-6">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold tracking-tight break-words">{title}</h2>
            {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Tutup"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
