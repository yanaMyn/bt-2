import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { StatusPill } from '../../components/StatusPill'
import { Button, Card, ErrorText, Field, inputClass } from '../../components/ui'
import { compareByMonth, compareBySession, maxSessionCount } from '../../lib/compare'
import { errorMessage } from '../../lib/errors'
import { downloadSheets, memberRecapSheet, monthRecapSheets, sessionRecapSheets } from '../../lib/exportXlsx'
import {
  availableMonths,
  memberRecap,
  monthRecap,
  sessionRecap,
  type MemberRecap,
  type RecapRow,
  type ReportData,
} from '../../lib/reports'
import { monthLabel, sessionTitle } from '../../lib/sessionLabel'
import type { Stats } from '../../lib/stats'
import { listCategories, listSessionStats, loadReportData } from './api'
import { CategoryCompareChart } from './CategoryCompareChart'

const MODES = [
  ['sesi', 'Per sesi'],
  ['bulan', 'Per bulan'],
  ['anggota', 'Per anggota'],
  ['grafik', 'Grafik'],
] as const
type Mode = (typeof MODES)[number][0]

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const categoryId = params.get('kategori') ?? ''
  const mode: Mode = MODES.some(([id]) => id === params.get('mode')) ? (params.get('mode') as Mode) : 'sesi'
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

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
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-200/70 p-1 sm:grid-cols-4" role="tablist">
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
              onChange={(e) =>
                update({ kategori: e.target.value || null, sesi: null, bulan: null, dari: null, sampai: null })
              }
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
        <CompareReport
          by={params.get('per') === 'bulan' ? 'bulan' : 'sesi'}
          offset={Number(params.get('ke') ?? 0) || 0}
          month={params.get('bulan')}
          onChange={update}
        />
      ) : (
        <>
          {!categoryId && <p className="text-muted">Pilih kategori untuk melihat laporan.</p>}
          {categoryId && isPending && <p className="text-muted">Memuat…</p>}
          <ErrorText>{error && errorMessage(error)}</ErrorText>
          {data && mode === 'sesi' && (
            <SessionReport data={data} sessionId={params.get('sesi')} onSession={(id) => update({ sesi: id })} />
          )}
          {data && mode === 'bulan' && (
            <MonthReport data={data} month={params.get('bulan')} onMonth={(m) => update({ bulan: m })} />
          )}
          {data && mode === 'anggota' && (
            <MemberReport
              data={data}
              from={params.get('dari')}
              to={params.get('sampai')}
              onRange={(dari, sampai) => update({ dari, sampai })}
            />
          )}
        </>
      )}
    </div>
  )
}

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

function SessionReport({
  data,
  sessionId,
  onSession,
}: {
  data: ReportData
  sessionId: string | null
  onSession: (id: string) => void
}) {
  const current = data.sessions.find((s) => s.id === sessionId) ?? data.sessions[0]
  const recap = useMemo(() => sessionRecap(data, current.id), [data, current.id])

  return (
    <>
      <Card className="flex flex-col gap-3">
        <Field label="Sesi">
          <select className={inputClass} value={current.id} onChange={(e) => onSession(e.target.value)}>
            {data.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionTitle(s)}
                {s.closed_at ? '' : ' (aktif)'}
              </option>
            ))}
          </select>
        </Field>
        {current.note && <p className="text-sm break-words text-muted">Catatan: {current.note}</p>}
        <Button
          variant="secondary"
          onClick={() => downloadSheets(`${data.category.name}_${current.label}`, sessionRecapSheets(recap))}
        >
          ⬇ Ekspor .xlsx
        </Button>
      </Card>

      <RecapTable rows={recap.rows} stats={recap.stats} />

      <Card className="p-0">
        <p className="border-b border-gray-100 p-3 font-bold">Daftar anggota ({recap.members.length})</p>
        <ul className="divide-y divide-gray-100">
          {recap.members.map(({ member, status }) => (
            <li key={member.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 break-words">
                {member.name} <span className="text-muted">({member.gender})</span>
              </span>
              <StatusPill status={status ?? undefined} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function MonthReport({
  data,
  month,
  onMonth,
}: {
  data: ReportData
  month: string | null
  onMonth: (month: string) => void
}) {
  const months = useMemo(() => availableMonths(data.sessions), [data.sessions])
  const current = month && months.includes(month) ? month : months[0]
  const recap = useMemo(() => monthRecap(data, current), [data, current])

  return (
    <>
      <Card className="flex flex-col gap-3">
        <Field label="Bulan">
          <select className={inputClass} value={current} onChange={(e) => onMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-muted">
          {recap.sessions.length} sesi bertanggal di bulan ini: {recap.sessions.map(sessionTitle).join('; ')}.
        </p>
        <Button
          variant="secondary"
          onClick={() => downloadSheets(`${data.category.name}_Bulan-${monthLabel(current)}`, monthRecapSheets(recap))}
        >
          ⬇ Ekspor .xlsx
        </Button>
      </Card>

      <RecapTable
        rows={recap.rows}
        stats={recap.stats}
        caption="Jumlah isian seluruh sesi di bulan ini. % hadir = isian berstatus hadir ÷ seluruh anggota-sesi."
      />

      <p className="font-bold">Rekap per anggota — {monthLabel(current)}</p>
      <MemberRecapTable recap={recap.members} emptyText="Tidak ada anggota pada bulan ini." />
    </>
  )
}

function MemberReport({
  data,
  from,
  to,
  onRange,
}: {
  data: ReportData
  from: string | null
  to: string | null
  onRange: (from: string, to: string) => void
}) {
  // Kronologis (terlama dulu) untuk pemilihan rentang.
  const chrono = useMemo(() => [...data.sessions].reverse(), [data.sessions])
  const fromIdx = Math.max(
    0,
    chrono.findIndex((s) => s.id === from),
  )
  const toFound = chrono.findIndex((s) => s.id === to)
  const toIdx = toFound < 0 ? chrono.length - 1 : toFound
  const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
  const range = chrono.slice(lo, hi + 1)
  const recap = useMemo(
    () =>
      memberRecap(
        data,
        range.map((s) => s.id),
      ),
    [data, range],
  )
  const rangeLabel = range.length === 1 ? range[0].label : `${range[0].label} sd ${range.at(-1)!.label}`

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dari sesi">
            <select
              className={inputClass}
              value={chrono[lo].id}
              onChange={(e) => onRange(e.target.value, chrono[hi].id)}
            >
              {chrono.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sampai sesi">
            <select
              className={inputClass}
              value={chrono[hi].id}
              onChange={(e) => onRange(chrono[lo].id, e.target.value)}
            >
              {chrono.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.closed_at ? '' : ' (aktif)'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-sm text-muted">
          {range.length} sesi. Persentase = sesi berstatus hadir ÷ sesi saat orang tersebut menjadi anggota.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            downloadSheets(`${data.category.name}_Rekap-Anggota_${rangeLabel}`, [
              { name: 'Rekap Anggota', rows: memberRecapSheet(recap) },
            ])
          }
        >
          ⬇ Ekspor .xlsx
        </Button>
      </Card>
      <MemberRecapTable recap={recap} emptyText="Tidak ada anggota pada rentang ini." />
    </>
  )
}

function CompareReport({
  by,
  offset,
  month,
  onChange,
}: {
  by: 'sesi' | 'bulan'
  offset: number
  month: string | null
  onChange: (patch: Record<string, string | null>) => void
}) {
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const {
    data: stats,
    isPending,
    error,
  } = useQuery({ queryKey: ['admin', 'session-stats'], queryFn: listSessionStats })

  const months = useMemo(() => [...new Set(stats?.map((s) => s.month))].sort().reverse(), [stats])
  const currentMonth = month && months.includes(month) ? month : months[0]
  const maxOffset = Math.max(0, maxSessionCount(stats ?? []) - 1)
  const currentOffset = Math.min(offset, maxOffset)

  const items = useMemo(() => {
    if (!categories || !stats) return []
    return by === 'sesi'
      ? compareBySession(categories, stats, currentOffset)
      : currentMonth
        ? compareByMonth(categories, stats, currentMonth)
        : []
  }, [by, categories, stats, currentOffset, currentMonth])

  const offsetLabel = (n: number) => (n === 0 ? 'Sesi aktif' : `${n} sesi sebelumnya`)

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-200/70 p-1" role="tablist" aria-label="Bandingkan">
          {(
            [
              ['sesi', 'Per sesi'],
              ['bulan', 'Per bulan'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={by === id}
              onClick={() => onChange({ per: id })}
              className={`min-h-11 rounded-xl px-2 font-medium ${by === id ? 'bg-white shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {by === 'sesi' ? (
          <Field label="Sesi" hint="Dihitung mundur per kategori dari sesi yang sedang berjalan.">
            <select
              className={inputClass}
              value={currentOffset}
              onChange={(e) => onChange({ ke: e.target.value === '0' ? null : e.target.value })}
            >
              {Array.from({ length: maxOffset + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {offsetLabel(n)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Bulan" hint="Gabungan semua sesi yang dimulai di bulan ini.">
            <select
              className={inputClass}
              value={currentMonth ?? ''}
              onChange={(e) => onChange({ bulan: e.target.value })}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {stats && (
        <Card>
          <CategoryCompareChart
            items={items}
            caption={
              by === 'sesi'
                ? `% hadir per kategori — ${offsetLabel(currentOffset).toLowerCase()}`
                : `% hadir per kategori — ${currentMonth ? monthLabel(currentMonth) : ''}`
            }
          />
        </Card>
      )}
    </>
  )
}
