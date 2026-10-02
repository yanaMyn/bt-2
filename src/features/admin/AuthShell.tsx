import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { inputClass } from '../../components/ui'

/** Kerangka layar masuk / ganti password: latar brand dengan kartu di tengah. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="hero-bg flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <span className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <ShieldCheck className="size-8" aria-hidden />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-brand-50/90">{description}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-6 shadow-float">{children}</div>
        {footer && <div className="mt-6 text-center">{footer}</div>}
      </div>
    </div>
  )
}

/** Input password dengan tombol lihat/sembunyikan. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputClass} pr-14`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
        className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
      >
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  )
}
