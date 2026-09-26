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
            value === g ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-gray-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
