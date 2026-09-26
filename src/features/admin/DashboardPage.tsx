import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Card } from '../../components/ui'
import { childrenOf } from '../../lib/criteria'
import { listActivitySummaries, listJamaah, listTransfers } from './api'
import { LEVEL_LABEL, useProfile } from './profile'
import { useUnits } from './units'

function Tile({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 hover:ring-brand-300">
      <span className="block text-3xl font-bold">{value}</span>
      <span className="text-muted">{label}</span>
    </Link>
  )
}

export function DashboardPage() {
  const profile = useProfile()
  const { data: units = [] } = useUnits()
  const { data: activities } = useQuery({ queryKey: ['admin', 'activities'], queryFn: listActivitySummaries })
  const { data: jamaah } = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })
  const { data: transfers } = useQuery({ queryKey: ['admin', 'transfers'], queryFn: listTransfers })

  const own = activities?.filter((a) => a.owner_unit_id === profile.unit_id)
  const running = own?.filter((a) => a.session_id).length
  const active = jamaah?.filter((m) => !m.inactive_since)
  const incomplete = active?.filter((m) => !m.birth_date).length
  const incoming = transfers?.filter((t) => t.status === 'pending' && t.to_kelompok === profile.unit_id).length
  const children = childrenOf(units, profile.unit_id)
  const kelompokCount =
    profile.unit_level === 'daerah' ? units.filter((u) => u.level === 'kelompok').length : children.length
  const n = (v: number | undefined) => (v === undefined ? '…' : v)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-muted">Admin {LEVEL_LABEL[profile.unit_level]}</p>
        <h1 className="text-2xl font-bold">
          {profile.unit_name}
          {profile.parent_name && <span className="font-normal text-muted"> · {profile.parent_name}</span>}
        </h1>
        <p className="text-muted">
          Masuk sebagai {profile.display_name} (@{profile.username})
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Kegiatan" value={n(own?.length)} to="/admin/kegiatan" />
        <Tile label="Sesi berjalan" value={n(running)} to="/admin/kegiatan" />
        <Tile label="Jamaah aktif" value={n(active?.length)} to="/admin/jamaah" />
        {profile.unit_level === 'daerah' && <Tile label="Desa" value={children.length} to="/admin/struktur" />}
        {profile.unit_level !== 'kelompok' && <Tile label="Kelompok" value={kelompokCount} to="/admin/struktur" />}
        {profile.unit_level === 'kelompok' && (
          <Tile label="Permintaan pindah masuk" value={n(incoming)} to="/admin/perpindahan" />
        )}
      </div>
      {!!incomplete && (
        <Card className="bg-yellow-50 ring-yellow-200">
          <p>
            <b>{incomplete} jamaah</b> belum punya tanggal lahir sehingga tidak masuk kegiatan berbatas umur.{' '}
            <Link to="/admin/jamaah?lengkap=belum" className="font-semibold text-brand-700 underline">
              Lihat daftar
            </Link>
          </p>
        </Card>
      )}
    </div>
  )
}
