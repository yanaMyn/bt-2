import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { StatusPill } from '../../components/StatusPill'
import { Button, Card, ErrorText, Field, inputClass } from '../../components/ui'
import { compareByRange } from '../../lib/compare'
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
import { downloadSheets, memberRecapSheet, rangeRecapSheets } from '../../lib/exportXlsx'
import {
  memberRecap,
  rangeRecap,
  sessionsInRange,
  type MemberRecap,
  type RecapRow,
  type ReportData,
} from '../../lib/reports'
import { sessionTitle, todayJakarta } from '../../lib/sessionLabel'
import type { Stats } from '../../lib/stats'
import { listCategories, listSessionStats, loadReportData } from './api'
import { CategoryCompareChart } from './CategoryCompareChart'
import { DateRangePicker } from './DateRangePicker'

const MODES = [
  ['rekap', 'Rekap'],
  ['anggota', 'Per anggota'],
  ['grafik', 'Grafik'],
] as const
type Mode = (typeof MODES)[number][0]

const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v))

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const categoryId = params.get('kategori') ?? ''
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
    enabled: Boolean(categoryId) && mode !== 'grafik',
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Laporan</h1>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-200/70 p-1" role="tablist">
          {MODES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => update({ mode: id })}
              className={`min-h-11 rounded-xl px-2 font-medium ${mode === id ? 'bg-white shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== 'grafik' && (
          <Field label="Kategori">
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => update({ kategori: e.target.value || null })}
            >
              <option value="">— Pilih kategori —</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? '' : ' (nonaktif)'}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      {mode === 'grafik' ? (
        <CompareReport range={chosen} onRange={setRange} />
      ) : (
        <>
          {!categoryId && <p className="text-muted">Pilih kategori untuk melihat laporan.</p>}
          {categoryId && isPending && <p className="text-muted">Memuat…</p>}
          <ErrorText>{error && errorMessage(error)}</ErrorText>
          {data && mode === 'rekap' && <RecapReport data={data} range={chosen} onRange={setRange} />}
          {data && mode === 'anggota' && <MemberReport data={data} range={chosen} onRange={setRange} />}
        </>
      )}
    </div>
  )
}

const sessionDates = (data: ReportData) => data.sessions.map((s) => s.session_date)

function RecapTable({ rows, stats, caption }: { rows: RecapRow[]; stats: Stats; caption?: string }) {
  return (
    <Card className="p-0">
      {caption && <p className="border-b border-gray-100 p-3 text-sm text-muted">{caption}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="border-b border-gray-200 text-sm text-muted">
            <tr>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">L</th>
              <th className="p-3 text-right font-medium">P</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="p-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-gray-400"
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

function MemberRecapTable({ recap, emptyText }: { recap: MemberRecap; emptyText: string }) {
  return (
    <Card className="p-0">
      {recap.rows.length === 0 ? (
        <p className="p-4 text-muted">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-gray-200 text-muted">
              <tr>
                <th className="sticky left-0 bg-white p-2 font-medium">Nama</th>
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
            <tbody className="divide-y divide-gray-100">
              {recap.rows.map((r) => (
                <tr key={r.member.id}>
                  <td className="sticky left-0 min-w-32 bg-white p-2">{r.member.name}</td>
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
}: {
  data: ReportData
  range: DateRange | null
  onRange: (r: DateRange) => void
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
              onClick={() => downloadSheets(`${data.category.name}_${rangeLabel(current)}`, rangeRecapSheets(recap))}
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
              <p className="border-b border-gray-100 p-3 font-bold">Daftar anggota ({recap.single.members.length})</p>
              <ul className="divide-y divide-gray-100">
                {recap.single.members.map(({ member, status }) => (
                  <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words">
                      {member.name} <span className="text-muted">({member.gender})</span>
                    </span>
                    <StatusPill status={status ?? undefined} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <>
              <p className="font-bold">Rekap per anggota</p>
              <MemberRecapTable recap={recap.members} emptyText="Tidak ada anggota pada sesi terpilih." />
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
}: {
  data: ReportData
  range: DateRange | null
  onRange: (r: DateRange) => void
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
            downloadSheets(`${data.category.name}_Rekap-Anggota_${rangeLabel(current)}`, [
              { name: 'Rekap Anggota', rows: [['Periode', rangeLabel(current)], [], ...memberRecapSheet(recap)] },
            ])
          }
        >
          ⬇ Ekspor .xlsx
        </Button>
      </Card>
      <MemberRecapTable recap={recap} emptyText="Tidak ada sesi pada pilihan ini." />
    </>
  )
}

function CompareReport({ range, onRange }: { range: DateRange | null; onRange: (r: DateRange) => void }) {
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const {
    data: stats,
    isPending,
    error,
  } = useQuery({ queryKey: ['admin', 'session-stats'], queryFn: listSessionStats })
  // Default: bulan ini.
  const current = range ?? presetRange('bulan-ini', todayJakarta())
  const dates = useMemo(() => stats?.map((s) => s.session_date) ?? [], [stats])
  const items = useMemo(
    () => (categories && stats ? compareByRange(categories, stats, current) : []),
    [categories, stats, current.from, current.to],
  )

  return (
    <>
      <Card>
        <DateRangePicker value={current} onChange={onRange} sessionDates={dates} />
      </Card>
      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {stats && (
        <Card>
          <CategoryCompareChart items={items} caption={`% hadir per kategori — ${rangeLabel(current)}`} />
        </Card>
      )}
    </>
  )
}
