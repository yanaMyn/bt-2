import { CircleAlert, CircleCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastOptions {
  message: string
  tone?: 'success' | 'error'
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((t: ToastOptions) => {
    clearTimeout(timer.current)
    setToast({ ...t, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), t.durationMs ?? 5000)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4"
        style={{ paddingBottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + var(--toast-offset, 0px))' }}
      >
        {toast && (
          <div
            key={toast.key}
            role="status"
            className="animate-sheet-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 py-3 pr-2 pl-4 text-white shadow-float"
          >
            {toast.tone === 'error' ? (
              <CircleAlert className="size-6 shrink-0 text-red-400" aria-hidden />
            ) : (
              <CircleCheck className="size-6 shrink-0 text-emerald-400" aria-hidden />
            )}
            <span className="flex-1 text-base">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-xl bg-white/10 px-4 font-semibold text-white transition hover:bg-white/20"
                onClick={() => {
                  toast.action!.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
