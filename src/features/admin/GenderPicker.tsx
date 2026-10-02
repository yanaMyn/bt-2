import type { Gender } from '../../lib/types'

export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis kelamin">
      {(
        [
          ['L', 'Laki-laki'],
          ['P', 'Perempuan'],
        ] as const
      ).map(([g, label]) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={`min-h-11 rounded-xl font-medium ring-1 ${
            value === g ? 'bg-brand-600 text-white ring-brand-600 shadow-brand' : 'bg-white ring-line'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
