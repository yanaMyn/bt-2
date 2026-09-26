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
              className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl px-5 text-left text-xl font-bold shadow-sm transition active:scale-[0.98] ${
                selected ? 'ring-4 ring-gray-900/80 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: s.color, color: readableText(s.color) }}
            >
              <span className="break-words">{s.label}</span>
              {selected && <span className="text-base font-semibold">✓ Saat ini</span>}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
