import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  CircleAlert,
  MapPin,
  Network,
  Plus,
  Radio,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { ProgressRing } from '../../components/StatCard'
import { Badge, Card, LiveDot } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import { stat } from '../../lib/stats'
import { summarySessionText } from '../../lib/summaryText'
import { listActivitySummaries, listJamaah, listTransfers } from './api'
import { LEVEL_LABEL, useProfile } from './profile'
import { useUnits } from './units'

const TILE_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
} as const

function Tile({
  label,
  value,
  to,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  to: string
  icon: LucideIcon
  tone: keyof typeof TILE_TONES
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-3xl border border-line/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
    >
      <span className={`flex size-11 items-center justify-center rounded-2xl ${TILE_TONES[tone]}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-3xl font-extrabold tracking-tight tabular-nums">{value}</span>
        <span className="text-sm font-semibold text-muted">{label}</span>
      </span>
    </Link>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line/70 bg-white px-4 font-semibold shadow-card transition hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-5 text-slate-400" aria-hidden />
    </Link>
  )
}

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date()))
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function DashboardPage() {
  const profile = useProfile()
  const { data: units = [] } = useUnits()
  const { data: activities } = useQuery({ queryKey: ['admin', 'activities'], queryFn: listActivitySummaries })
  const { data: jamaah } = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })
  const { data: transfers } = useQuery({ queryKey: ['admin', 'transfers'], queryFn: listTransfers })

  const own = activities?.filter((a) => a.owner_unit_id === profile.unit_id)
  const runningList = own?.filter((a) => a.session_id) ?? []
  const active = jamaah?.filter((m) => !m.inactive_since)
  const incomplete = active?.filter((m) => !m.birth_date).length
  const incoming = transfers?.filter((t) => t.status === 'pending' && t.to_kelompok === profile.unit_id).length
  const children = childrenOf(units, profile.unit_id)
  const kelompokCount =
    profile.unit_level === 'daerah' ? units.filter((u) => u.level === 'kelompok').length : children.length
  const n = (v: number | undefined) => (v === undefined ? '…' : v)
  const isKelompok = profile.unit_level === 'kelompok'

  return (
    <div className="flex flex-col gap-6">
      <section className="hero-bg animate-rise relative overflow-hidden rounded-[2rem] p-6 text-white shadow-float">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full bg-white/10 blur-2xl"
        />
        <p className="text-brand-100">{greeting()},</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{profile.display_name}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold ring-1 ring-white/20">
          <MapPin className="size-4" aria-hidden />
          Admin {LEVEL_LABEL[profile.unit_level]} {profile.unit_name}
          {profile.parent_name && <span className="font-normal text-white/80">· {profile.parent_name}</span>}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ringkasan">
        <Tile label="Kegiatan" value={n(own?.length)} to="/admin/kegiatan" icon={CalendarDays} tone="brand" />
        <Tile
          label="Sesi berjalan"
          value={n(own ? runningList.length : undefined)}
          to="/admin/kegiatan"
          icon={Radio}
          tone="rose"
        />
        <Tile label="Jamaah aktif" value={n(active?.length)} to="/admin/jamaah" icon={Users} tone="sky" />
        {isKelompok ? (
          <Tile label="Pindah masuk" value={n(incoming)} to="/admin/perpindahan" icon={ArrowLeftRight} tone="violet" />
        ) : (
          <Tile
            label={profile.unit_level === 'daerah' ? `Kelompok · ${children.length} desa` : 'Kelompok'}
            value={kelompokCount}
            to="/admin/struktur"
            icon={Network}
            tone="amber"
          />
        )}
      </section>

      {!!incomplete && (
        <Link
          to="/admin/jamaah?lengkap=belum"
          className="flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900 transition hover:bg-amber-100"
        >
          <CircleAlert className="size-6 shrink-0 text-amber-600" aria-hidden />
          <span className="flex-1">
            <b>{incomplete} jamaah</b> belum punya tanggal lahir, jadi tidak masuk kegiatan berbatas umur.
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      {runningList.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <LiveDot /> Sedang berlangsung
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {runningList.map((c) => {
              const pct = stat(c.present, c.total).percent
              return (
                <Link key={c.category_id} to={`/admin/kegiatan/${c.category_id}?tab=sesi`}>
                  <Card className="flex items-center gap-4 transition hover:shadow-float">
                    <div className="relative">
                      <ProgressRing percent={pct} size={60} stroke={6} />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums text-brand-700">
                        {pct}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold break-words">{c.name}</p>
                      <p className="text-sm text-muted">{summarySessionText(c)}</p>
                      <Badge tone="brand" className="mt-1">
                        {c.present}/{c.total} hadir
                      </Badge>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Aksi cepat</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickAction to="/admin/kegiatan" icon={Plus} label="Buat atau jadwalkan kegiatan" />
          {isKelompok && <QuickAction to="/admin/jamaah/import" icon={Upload} label="Import jamaah dari .xlsx" />}
          {!isKelompok && <QuickAction to="/admin/struktur" icon={Network} label="Kelola struktur" />}
          <QuickAction to="/admin/laporan" icon={ChartColumn} label="Lihat laporan kehadiran" />
        </div>
      </section>
    </div>
  )
}
