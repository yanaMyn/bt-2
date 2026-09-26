import type { Stat } from '../lib/stats'

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden>
      <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function StatCard({ label, stat, large = false }: { label: string; stat: Stat; large?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-muted">{label}</span>
        <span className="text-muted tabular-nums">
          {stat.present}/{stat.total}
        </span>
      </div>
      <div className={`my-1 font-bold tabular-nums text-brand-700 ${large ? 'text-4xl' : 'text-3xl'}`}>
        {stat.percent}%
      </div>
      <ProgressBar percent={stat.percent} />
    </div>
  )
}
