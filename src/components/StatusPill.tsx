import { readableText } from '../lib/color'
import type { Status } from '../lib/types'

export function StatusPill({ status }: { status: Status | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-gray-400 px-3 py-1 text-sm font-medium text-muted">
        Belum
      </span>
    )
  }
  return (
    <span
      className="inline-flex max-w-[45%] shrink-0 items-center rounded-full px-3 py-1 text-sm font-semibold"
      style={{ backgroundColor: status.color, color: readableText(status.color) }}
    >
      <span className="truncate">{status.label}</span>
    </span>
  )
}
