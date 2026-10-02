import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { StatusPill } from '../../components/StatusPill'
import { Button, Card, ErrorText, Field, inputClass, PageHeader, Segmented } from '../../components/ui'
import { compareByRange } from '../../lib/compare'
import { unitLabel } from '../../lib/criteria'
import {
  allRange,
  formatDateShort,
  nearestDates,
  normalizeRange,
  presetRange,
  rangeLabel,
  type DateRange,
} from '../../lib/dateRange'
import { errorMessage } from '../../lib/errors'
import { downloadSheets, memberRecapSheet, rangeRecapSheets, type KelompokOf } from '../../lib/exportXlsx'
import { historySummary } from '../../lib/memberHistory'
import {
  filterByKelompok,
  kelompokIds,
  latestKelompok,
  memberRecap,
  rangeRecap,
  sessionsInRange,
  type MemberRecap,
  type RecapRow,
  type ReportData,
} from '../../lib/reports'
import { sessionTitle, todayJakarta } from '../../lib/sessionLabel'
import { hasStarted } from '../../lib/sessionTime'
import type { Stats } from '../../lib/stats'
import type { Category, OrgUnit, UnitLevel } from '../../lib/types'
import { listCategories, listJamaah, listSessionStats, loadReportData, memberHistory } from './api'
import { CategoryCompareChart } from './CategoryCompareChart'
import { DateRangePicker } from './DateRangePicker'
import { LEVEL_LABEL, useProfile } from './profile'
import { useUnits } from './units'

const MODES = [
  ['rekap', 'Rekap'],
  ['anggota', 'Per anggota'],
  ['jamaah', 'Per jamaah'],
  ['grafik', 'Grafik'],
] as const
type Mode = (typeof MODES)[number][0]

const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v))

const LEVEL_ORDER: Record<UnitLevel, number> = { daerah: 0, desa: 1, kelompok: 2 }

/** Kegiatan dikelompokkan per unit pemilik: unit sendiri dulu, lalu Daerah → Desa → Kelompok. */
function groupByOwner(categories: readonly Category[], units: readonly OrgUnit[], myUnit: string) {
  const groups = new Map<string, Category[]>()
  for (const c of categories) groups.set(c.owner_unit_id, [...(groups.get(c.owner_unit_id) ?? []), c])
  const level = (id: string) => units.find((u) => u.id === id)?.level ?? 'kelompok'
  return [...groups]
    .map(([unitId, list]) => ({ unitId, level: level(unitId), list }))
    .sort(
      (a, b) =>
        Number(b.unitId === myUnit) - Number(a.unitId === myUnit) ||
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        unitLabel(units, a.unitId).localeCompare(unitLabel(units, b.unitId), 'id'),
    )
}

export function ReportsPage() {
  const profile = useProfile()
  const { data: units = [] } = useUnits()
  const [params, setParams] = useSearchParams()
  const categoryId = params.get('kategori') ?? ''
  const kelompokParam = params.get('kelompok') ?? ''
  const mode: Mode = MODES.some(([id]) => id === params.get('mode')) ? (params.get('mode') as Mode) : 'rekap'
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  // Rentang dari URL (dari/sampai); null = pakai default tiap tab.
  const from = params.get('dari')
  const to = params.get('sampai')
  const chosen: DateRange | null = isDate(from) && isDate(to) ? normalizeRange(from, to) : null
  const setRange = (r: DateRange) => update({ dari: r.from, sampai: r.to })

  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'report', categoryId],
    queryFn: () => loadReportData(categoryId),
    enabled: Boolean(categoryId) && (mode === 'rekap' || mode === 'anggota'),
  })

  // Filter & kolom kelompok asal hanya relevan bila peserta berasal dari lebih dari satu kelompok.
  const kelompokOptions = useMemo(
    () =>
      data
        ? [...kelompokIds(data)]
            .map((id) => ({ id, label: unitLabel(units, id) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'id'))
        : [],
    [data, units],
  )
  const multiKelompok = kelompokOptions.length > 1
  const kelompok = kelompokOptions.some((k) => k.id === kelompokParam) ? kelompokParam : ''
  const scoped = useMemo(() => (data ? filterByKelompok(data, kelompok || null) : null), [data, kelompok])
  const kelompokOf = useMemo<KelompokOf | undefined>(() => {
    if (!data || !multiKelompok) return undefined
    const latest = latestKelompok(data)
    return (memberId) => {
      const k = latest.get(memberId)
      return k ? unitLabel(units, k) : undefined
    }
  }, [data, multiKelompok, units])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Laporan" description="Rekap kehadiran, riwayat per jamaah, dan grafik perbandingan." />
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <Segmented
          label="Jenis laporan"
          value={mode}
          options={MODES.map(([id, label]) => ({ value: id, label }))}
          onChange={(id) => update({ mode: id })}
          className="min-w-max"
        />
      </div>
      <Card className="flex flex-col gap-3">
        {(mode === 'rekap' || mode === 'anggota') && (
          <Field label="Kegiatan">
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => update({ kategori: e.target.value || null, kelompok: null })}
            >
              <option value="">— Pilih kegiatan —</option>
              {groupByOwner(categories ?? [], units, profile.unit_id).map((g) => (
                <optgroup key={g.unitId} label={`${LEVEL_LABEL[g.level]} ${unitLabel(units, g.unitId)}`}>
                  {g.list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_active ? '' : ' (nonaktif)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        )}
        {(mode === 'rekap' || mode === 'anggota') && multiKelompok && (
          <Field label="Kelompok asal">
            <select
              className={inputClass}
              value={kelompok}
              onChange={(e) => update({ kelompok: e.target.value || null })}
            >
              <option value="">Semua kelompok</option>
              {kelompokOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      {mode === 'grafik' ? (
        <CompareReport
          range={chosen}
          onRange={setRange}
          level={(params.get('level') ?? '') as UnitLevel | ''}
          onLevel={(l) => update({ level: l || null })}
        />
      ) : mode === 'jamaah' ? (
        <JamaahReport
          memberId={params.get('jamaah') ?? ''}
          onMember={(id) => update({ jamaah: id || null })}
          range={chosen}
          onRange={setRange}
        />
      ) : (
        <>
          {!categoryId && <p className="text-muted">Pilih kegiatan untuk melihat laporan.</p>}
          {categoryId && isPending && <p className="text-muted">Memuat…</p>}
          <ErrorText>{error && errorMessage(error)}</ErrorText>
          {scoped && mode === 'rekap' && (
            <RecapReport
              data={scoped}
              range={chosen}
              onRange={setRange}
              kelompokOf={kelompokOf}
              suffix={kelompok ? unitLabel(units, kelompok) : ''}
            />
          )}
          {scoped && mode === 'anggota' && (
            <MemberReport
              data={scoped}
              range={chosen}
              onRange={setRange}
              kelompokOf={kelompokOf}
              suffix={kelompok ? unitLabel(units, kelompok) : ''}
            />
          )}
        </>
      )}
    </div>
  )
}

// Hanya sesi yang sudah dibuka; sesi dijadwalkan tidak masuk laporan.
const sessionDates = (data: ReportData) => data.sessions.filter((s) => hasStarted(s)).map((s) => s.session_date)

function RecapTable({ rows, stats, caption }: { rows: RecapRow[]; stats: Stats; caption?: string }) {
  return (
    <Card className="p-0">
      {caption && <p className="border-b border-slate-100 p-3 text-sm text-muted">{caption}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="border-b border-slate-200 text-sm text-muted">
            <tr>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">L</th>
              <th className="p-3 text-right font-medium">P</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="p-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-slate-400"
                      style={{ backgroundColor: r.color ?? 'transparent' }}
                    />
                    {r.label}
                  </span>
                </td>
                <td className="p-3 text-right">{r.L}</td>
                <td className="p-3 text-right">{r.P}</td>
                <td className="p-3 text-right font-semibold">{r.total}</td>
              </tr>
            ))}
            <tr className="bg-brand-50 font-bold text-brand-800">
              <td className="p-3">% Hadir</td>
              <td className="p-3 text-right">{stats.L.percent}%</td>
              <td className="p-3 text-right">{stats.P.percent}%</td>
              <td className="p-3 text-right">{stats.all.percent}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function MemberRecapTable({
  recap,
  emptyText,
  kelompokOf,
}: {
  recap: MemberRecap
  emptyText: string
  kelompokOf?: KelompokOf
}) {
  return (
    <Card className="p-0">
      {recap.rows.length === 0 ? (
        <p className="p-4 text-muted">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-slate-200 text-muted">
              <tr>
                <th className="sticky left-0 bg-white p-2 font-medium">Nama</th>
                {kelompokOf && <th className="p-2 font-medium">Kelompok</th>}
                {recap.statuses.map((s) => (
                  <th key={s.id} className="p-2 text-right font-medium whitespace-nowrap">
                    {s.label}
                  </th>
                ))}
                <th className="p-2 text-right font-medium">Belum</th>
                <th className="p-2 text-right font-medium">Sesi</th>
                <th className="p-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recap.rows.map((r) => (
                <tr key={r.member.id}>
                  <td className="sticky left-0 min-w-32 bg-white p-2">{r.member.name}</td>
                  {kelompokOf && <td className="p-2 whitespace-nowrap text-muted">{kelompokOf(r.member.id)}</td>}
                  {recap.statuses.map((s) => (
                    <td key={s.id} className="p-2 text-right">
                      {r.counts.get(s.id) ?? 0}
                    </td>
                  ))}
                  <td className="p-2 text-right">{r.belum}</td>
                  <td className="p-2 text-right">{r.sessions}</td>
                  <td className="p-2 text-right font-bold text-brand-700">{r.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RecapReport({
  data,
  range,
  onRange,
  kelompokOf,
  suffix,
}: {
  data: ReportData
  range: DateRange | null
  onRange: (r: DateRange) => void
  kelompokOf?: KelompokOf
  /** Nama kelompok yang difilter, untuk nama file ekspor. */
  suffix: string
}) {
  const dates = sessionDates(data)
  // Default: tanggal sesi terbaru.
  const latest = allRange(dates)?.to ?? todayJakarta()
  const current = range ?? { from: latest, to: latest }
  const recap = useMemo(() => rangeRecap(data, current), [data, current.from, current.to])
  const near = nearestDates(dates, current)

  return (
    <>
      <Card>
        <DateRangePicker value={current} onChange={onRange} sessionDates={dates} />
      </Card>

      {recap.sessions.length === 0 ? (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">
            Tidak ada sesi pada {current.from === current.to ? 'tanggal ini' : 'rentang ini'}.
          </p>
          {(near.before || near.after) && (
            <div className="flex flex-wrap gap-2">
              <span className="w-full text-sm text-muted">Sesi terdekat:</span>
              {[near.before, near.after]
                .filter((d): d is string => Boolean(d))
                .map((d) => (
                  <Button key={d} variant="secondary" onClick={() => onRange({ from: d, to: d })}>
                    {formatDateShort(d)}
                  </Button>
                ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <p className="font-bold">
              {rangeLabel(current)} · {recap.sessions.length} sesi
            </p>
            <ul className="text-sm text-muted">
              {recap.sessions.map((s) => (
                <li key={s.id} className="break-words">
                  • {sessionTitle(s)}
                  {s.closed_at ? '' : ' (aktif)'}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              onClick={() =>
                downloadSheets(
                  [data.category.name, suffix, rangeLabel(current)].filter(Boolean).join('_'),
                  rangeRecapSheets(recap, kelompokOf),
                )
              }
            >
              ⬇ Ekspor .xlsx
            </Button>
          </Card>

          <RecapTable
            rows={recap.rows}
            stats={recap.stats}
            caption={
              recap.sessions.length > 1
                ? 'Jumlah isian seluruh sesi terpilih. % hadir = isian berstatus hadir ÷ seluruh anggota-sesi.'
                : undefined
            }
          />

          {recap.single ? (
            <Card className="p-0">
              <p className="border-b border-slate-100 p-3 font-bold">Daftar anggota ({recap.single.members.length})</p>
              <ul className="divide-y divide-slate-100">
                {recap.single.members.map(({ member, status }) => (
                  <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words">
                      {member.name} <span className="text-muted">({member.gender})</span>
                      {kelompokOf && <span className="block text-sm text-muted">{kelompokOf(member.id)}</span>}
                    </span>
                    <StatusPill status={status ?? undefined} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <>
              <p className="font-bold">Rekap per anggota</p>
              <MemberRecapTable
                recap={recap.members}
                emptyText="Tidak ada anggota pada sesi terpilih."
                kelompokOf={kelompokOf}
              />
            </>
          )}
        </>
      )}
    </>
  )
}

function MemberReport({
  data,
  range,
  onRange,
  kelompokOf,
  suffix,
}: {
  data: ReportData
  range: DateRange | null
  onRange: (r: DateRange) => void
  kelompokOf?: KelompokOf
  suffix: string
}) {
  const dates = sessionDates(data)
  // Default: semua sesi.
  const current = range ?? allRange(dates) ?? { from: todayJakarta(), to: todayJakarta() }
  const sessions = useMemo(() => sessionsInRange(data.sessions, current), [data, current.from, current.to])
  const recap = useMemo(
    () =>
      memberRecap(
        data,
        sessions.map((s) => s.id),
      ),
    [data, sessions],
  )

  return (
    <>
      <Card className="flex flex-col gap-3">
        <DateRangePicker value={current} onChange={onRange} sessionDates={dates} />
        <p className="text-sm text-muted">
          {rangeLabel(current)} · {sessions.length} sesi. Persentase = sesi berstatus hadir ÷ sesi saat orang tersebut
          menjadi anggota.
        </p>
        <Button
          variant="secondary"
          disabled={sessions.length === 0}
          onClick={() =>
            downloadSheets(
              [data.category.name, 'Rekap-Anggota', suffix, rangeLabel(current)].filter(Boolean).join('_'),
              [
                {
                  name: 'Rekap Anggota',
                  rows: [['Periode', rangeLabel(current)], [], ...memberRecapSheet(recap, kelompokOf)],
                },
              ],
            )
          }
        >
          ⬇ Ekspor .xlsx
        </Button>
      </Card>
      <MemberRecapTable recap={recap} emptyText="Tidak ada sesi pada pilihan ini." kelompokOf={kelompokOf} />
    </>
  )
}

const LEVEL_FILTERS: { value: UnitLevel | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'kelompok', label: 'Kelompok' },
  { value: 'desa', label: 'Desa' },
  { value: 'daerah', label: 'Daerah' },
]

function CompareReport({
  range,
  onRange,
  level,
  onLevel,
}: {
  range: DateRange | null
  onRange: (r: DateRange) => void
  level: UnitLevel | ''
  onLevel: (l: UnitLevel | '') => void
}) {
  const { data: units = [] } = useUnits()
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const {
    data: stats,
    isPending,
    error,
  } = useQuery({ queryKey: ['admin', 'session-stats'], queryFn: listSessionStats })
  // Default: bulan ini.
  const current = range ?? presetRange('bulan-ini', todayJakarta())
  const dates = useMemo(() => stats?.map((s) => s.session_date) ?? [], [stats])
  const items = useMemo(() => {
    if (!categories || !stats) return []
    const shown = categories
      .filter((c) => !level || units.find((u) => u.id === c.owner_unit_id)?.level === level)
      .map((c) => ({ id: c.id, is_active: c.is_active, name: `${c.name} · ${unitLabel(units, c.owner_unit_id)}` }))
    return compareByRange(shown, stats, current)
  }, [categories, stats, units, level, current.from, current.to])

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Level pemilik kegiatan">
          {LEVEL_FILTERS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => onLevel(l.value)}
              className={`min-h-11 rounded-full px-4 font-medium ring-1 ${
                level === l.value ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-line'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <DateRangePicker value={current} onChange={onRange} sessionDates={dates} />
      </Card>
      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {stats && (
        <Card>
          <CategoryCompareChart items={items} caption={`% hadir per kegiatan — ${rangeLabel(current)}`} />
        </Card>
      )}
    </>
  )
}

function JamaahReport({
  memberId,
  onMember,
  range,
  onRange,
}: {
  memberId: string
  onMember: (id: string) => void
  range: DateRange | null
  onRange: (r: DateRange) => void
}) {
  const { data: units = [] } = useUnits()
  const { data: jamaah } = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })
  const [search, setSearch] = useState('')
  const today = todayJakarta()
  // Default: awal tahun ini s.d. hari ini.
  const current = range ?? { from: `${today.slice(0, 4)}-01-01`, to: today }
  const member = jamaah?.find((m) => m.id === memberId)
  const history = useQuery({
    queryKey: ['admin', 'history', memberId, current.from, current.to],
    queryFn: () => memberHistory(memberId, current.from, current.to),
    enabled: Boolean(member),
  })
  const summary = useMemo(() => historySummary(history.data ?? []), [history.data])
  const dates = useMemo(() => history.data?.map((r) => r.session_date) ?? [], [history.data])

  const q = search.trim().toLocaleLowerCase('id')
  const matches = q && jamaah ? jamaah.filter((m) => m.name.toLocaleLowerCase('id').includes(q)).slice(0, 20) : []

  if (!member) {
    return (
      <Card className="flex flex-col gap-3">
        <Field label="Cari jamaah">
          <input
            type="search"
            className={inputClass}
            placeholder={jamaah ? `Ketik nama (${jamaah.length} jamaah dalam cakupan)` : 'Memuat…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        {q && matches.length === 0 && <p className="text-muted">Nama tidak ditemukan.</p>}
        <ul className="divide-y divide-slate-100">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onMember(m.id)}
                className="flex min-h-12 w-full flex-col justify-center py-2 text-left hover:bg-slate-50"
              >
                <span>
                  {m.name} <span className="text-muted">({m.gender})</span>
                  {m.inactive_since && <span className="text-sm text-muted"> · nonaktif</span>}
                </span>
                <span className="text-sm text-muted">{unitLabel(units, m.kelompok_id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  function exportHistory() {
    const rows = history.data ?? []
    downloadSheets(`Riwayat_${member!.name}_${rangeLabel(current)}`, [
      {
        name: 'Ringkasan',
        rows: [
          ['Nama', member!.name],
          ['Kelompok', unitLabel(units, member!.kelompok_id)],
          ['Periode', rangeLabel(current)],
          [],
          ['Kegiatan', 'Tingkat', 'Pemilik', 'Sesi', 'Hadir', '% Hadir'],
          ...summary.activities.map((a) => [
            a.category_name,
            LEVEL_LABEL[a.owner_level],
            a.owner_name,
            a.sessions,
            a.present,
            `${a.percent}%`,
          ]),
          ['Total', '', '', summary.sessions, summary.present, `${summary.percent}%`],
        ],
      },
      {
        name: 'Riwayat',
        rows: [
          ['Tanggal', 'Kegiatan', 'Tingkat', 'Kelompok asal', 'Status'],
          ...rows.map((r) => [
            r.session_label,
            r.category_name,
            LEVEL_LABEL[r.owner_level],
            r.kelompok_name,
            r.status_label ?? 'Belum',
          ]),
        ],
      },
    ])
  }

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold">
              {member.name} <span className="font-normal text-muted">({member.gender})</span>
            </p>
            <p className="text-muted">{unitLabel(units, member.kelompok_id)}</p>
          </div>
          <Button variant="secondary" onClick={() => onMember('')}>
            Ganti jamaah
          </Button>
        </div>
        <DateRangePicker value={current} onChange={onRange} sessionDates={dates} />
        <Button variant="secondary" disabled={!history.data?.length} onClick={exportHistory}>
          ⬇ Ekspor .xlsx
        </Button>
      </Card>
      {history.isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{history.error && errorMessage(history.error)}</ErrorText>
      {history.data && history.data.length === 0 && (
        <p className="text-muted">Tidak ada sesi yang diikuti pada {rangeLabel(current)}.</p>
      )}
      {history.data && history.data.length > 0 && (
        <>
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="border-b border-slate-200 text-muted">
                  <tr>
                    <th className="p-2 font-medium">Kegiatan</th>
                    <th className="p-2 text-right font-medium">Sesi</th>
                    <th className="p-2 text-right font-medium">Hadir</th>
                    <th className="p-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.activities.map((a) => (
                    <tr key={a.category_id}>
                      <td className="p-2">
                        {a.category_name}
                        <span className="block text-xs text-muted">
                          {LEVEL_LABEL[a.owner_level]} {a.owner_name}
                        </span>
                      </td>
                      <td className="p-2 text-right">{a.sessions}</td>
                      <td className="p-2 text-right">{a.present}</td>
                      <td className="p-2 text-right font-bold text-brand-700">{a.percent}%</td>
                    </tr>
                  ))}
                  <tr className="bg-brand-50 font-bold text-brand-800">
                    <td className="p-2">Semua kegiatan</td>
                    <td className="p-2 text-right">{summary.sessions}</td>
                    <td className="p-2 text-right">{summary.present}</td>
                    <td className="p-2 text-right">{summary.percent}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-0">
            <p className="border-b border-slate-100 p-3 font-bold">Riwayat ({history.data.length} sesi)</p>
            <ul className="divide-y divide-slate-100">
              {[...history.data].reverse().map((r) => (
                <li key={r.session_id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 break-words">
                    {r.category_name}
                    <span className="block text-sm text-muted">
                      {r.session_label} · {LEVEL_LABEL[r.owner_level]}
                    </span>
                  </span>
                  <StatusPill
                    status={
                      r.status_id
                        ? {
                            id: r.status_id,
                            category_id: r.category_id,
                            label: r.status_label ?? '',
                            color: r.status_color ?? '#9ca3af',
                            sort_order: 0,
                            counts_as_present: r.counts_as_present,
                            archived_at: null,
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  )
}
