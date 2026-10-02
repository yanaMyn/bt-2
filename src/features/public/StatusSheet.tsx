import { Check } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { readableText } from '../../lib/color'
import type { Member, Status } from '../../lib/types'

export function StatusSheet({
  member,
  statuses,
  currentStatusId,
  onPick,
  onClose,
}: {
  member: Member
  statuses: Status[]
  currentStatusId: string | undefined
  onPick: (statusId: string) => void
  onClose: () => void
}) {
  const active = statuses.filter((s) => !s.archived_at)
  return (
    <BottomSheet title={member.name} subtitle="Pilih status kehadiran" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {active.map((s) => {
          const selected = s.id === currentStatusId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              aria-pressed={selected}
              className={`flex min-h-[4.5rem] items-center justify-between gap-3 rounded-3xl px-6 text-left text-xl font-bold shadow-card transition hover:brightness-105 active:scale-[0.98] ${
                selected ? 'ring-4 ring-slate-900/80 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: s.color, color: readableText(s.color) }}
            >
              <span className="break-words">{s.label}</span>
              {selected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-sm font-semibold">
                  <Check className="size-4" aria-hidden /> Saat ini
                </span>
              )}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
