import { useState } from 'react'
import { inputClass } from '../../components/ui'
import { allRange, normalizeRange, presetRange, type DateRange, type Preset } from '../../lib/dateRange'
import { todayJakarta } from '../../lib/sessionLabel'

const PRESETS: [Preset, string][] = [
  ['hari-ini', 'Hari ini'],
  ['bulan-ini', 'Bulan ini'],
  ['bulan-lalu', 'Bulan lalu'],
]

/** Pilih satu tanggal atau rentang lewat kalender bawaan HP, plus tombol cepat. */
export function DateRangePicker({
  value,
  onChange,
  sessionDates,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Tanggal sesi yang ada, untuk tombol "Semua". */
  sessionDates: readonly string[]
}) {
  const [mode, setMode] = useState<'tanggal' | 'rentang'>(value.from === value.to ? 'tanggal' : 'rentang')
  const all = allRange(sessionDates)

  function apply(range: DateRange) {
    setMode(range.from === range.to ? 'tanggal' : 'rentang')
    onChange(range)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/60 p-1"
        role="tablist"
        aria-label="Jenis pilihan tanggal"
      >
        {(
          [
            ['tanggal', 'Tanggal'],
            ['rentang', 'Rentang'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id)
              if (id === 'tanggal') onChange({ from: value.from, to: value.from })
            }}
            className={`min-h-11 rounded-xl px-2 font-medium ${mode === id ? 'bg-white text-ink shadow-card' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'tanggal' ? (
        <label className="block">
          <span className="mb-1 block font-medium">Tanggal</span>
          <input
            type="date"
            className={inputClass}
            value={value.from}
            onChange={(e) => e.target.value && onChange({ from: e.target.value, to: e.target.value })}
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className="mb-1 block font-medium">Dari</span>
            <input
              type="date"
              className={inputClass}
              value={value.from}
              onChange={(e) => e.target.value && onChange(normalizeRange(e.target.value, value.to))}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block font-medium">Sampai</span>
            <input
              type="date"
              className={inputClass}
              value={value.to}
              onChange={(e) => e.target.value && onChange(normalizeRange(value.from, e.target.value))}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            onClick={() => apply(presetRange(preset, todayJakarta()))}
            className="min-h-10 rounded-full bg-white px-3 text-sm font-medium ring-1 ring-line hover:bg-slate-50"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled={!all}
          onClick={() => all && apply(all)}
          className="min-h-10 rounded-full bg-white px-3 text-sm font-medium ring-1 ring-line hover:bg-slate-50 disabled:opacity-50"
        >
          Semua
        </button>
      </div>
    </div>
  )
}
