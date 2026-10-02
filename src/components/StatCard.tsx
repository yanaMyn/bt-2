import type { Stat } from '../lib/stats'

export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} aria-hidden>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Cincin persentase (SVG) untuk ringkasan kehadiran. */
export function ProgressRing({ percent, size = 64, stroke = 7 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)}
        className="stroke-brand-500 transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  )
}

export function StatCard({ label, stat, large = false }: { label: string; stat: Stat; large?: boolean }) {
  if (large) {
    return (
      <div className="flex items-center gap-4 rounded-3xl border border-line/70 bg-white p-5 shadow-card">
        <div className="relative">
          <ProgressRing percent={stat.percent} size={84} stroke={9} />
          <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums text-brand-700">
            {stat.percent}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-muted">{label}</p>
          <p className="text-3xl font-extrabold tracking-tight tabular-nums">
            {stat.present}
            <span className="text-xl font-bold text-slate-400">/{stat.total}</span>
          </p>
          <p className="text-sm text-muted">sudah hadir</p>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-3xl border border-line/70 bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-muted">{label}</span>
        <span className="text-sm text-muted tabular-nums">
          {stat.present}/{stat.total}
        </span>
      </div>
      <div className="my-1 text-2xl font-extrabold tracking-tight tabular-nums text-brand-700">{stat.percent}%</div>
      <ProgressBar percent={stat.percent} />
    </div>
  )
}
