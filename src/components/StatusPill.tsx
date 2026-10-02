import { readableText } from '../lib/color'
import type { Status } from '../lib/types'

export function StatusPill({ status }: { status: Status | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border-2 border-dashed border-slate-300 px-3 py-1 text-sm font-semibold text-slate-500">
        Belum
      </span>
    )
  }
  return (
    <span
      className="inline-flex max-w-[45%] shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-bold shadow-xs"
      style={{ backgroundColor: status.color, color: readableText(status.color) }}
    >
      <span className="truncate">{status.label}</span>
    </span>
  )
}
