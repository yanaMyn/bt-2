import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { Button, Card, ErrorText } from '../../components/ui'
import { criteriaText } from '../../lib/criteria'
import { errorMessage } from '../../lib/errors'
import { stat } from '../../lib/stats'
import { summarySessionText } from '../../lib/summaryText'
import { ActivityForm, EMPTY_ACTIVITY } from './ActivityForm'
import { createActivity, listActivitySummaries, listTemplates } from './api'
import { InactiveBadge } from './InactiveBadge'
import { LEVEL_LABEL, useProfile } from './profile'
import { useUnits } from './units'

export function KegiatanPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'activities'], queryFn: listActivitySummaries })
  const { data: templates } = useQuery({ queryKey: ['admin', 'templates'], queryFn: listTemplates })
  const { data: units } = useUnits()
  const [creating, setCreating] = useState(false)

  const create = useMutation({
    mutationFn: createActivity,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      setCreating(false)
      navigate(`/admin/kegiatan/${r.id}?tab=sesi`)
    },
  })

  // Daftar ini hanya kegiatan milik unit admin; kegiatan unit di bawahnya dilihat lewat Laporan.
  const own = (data ?? []).filter((c) => c.owner_unit_id === profile.unit_id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Kegiatan</h1>
          <p className="text-muted">
            Kegiatan milik {LEVEL_LABEL[profile.unit_level]} {profile.unit_name}. Peserta dihitung otomatis dari
            kriteria.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!units}>
          + Kegiatan
        </Button>
      </div>

      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {data && own.length === 0 && (
        <Card>
          <p className="text-muted">
            Belum ada kegiatan. Buat kegiatan dari templat (mis. Caberawit, Remaja, Ibu-ibu).
          </p>
        </Card>
      )}
      <ul className="flex flex-col gap-2">
        {own.map((c) => (
          <li key={c.category_id}>
            <Link
              to={`/admin/kegiatan/${c.category_id}`}
              className={`flex items-center justify-between gap-3 rounded-2xl p-4 shadow-sm ring-1 ring-black/5 hover:ring-brand-500 ${
                c.is_active ? 'bg-white' : 'bg-gray-100'
              }`}
            >
              <div className="min-w-0">
                <p className="font-bold break-words">
                  {c.name} {c.pin_enabled && <span title="PIN aktif">🔒</span>} {!c.is_active && <InactiveBadge />}
                </p>
                <p className="text-sm text-muted">{criteriaText(c)}</p>
                <p className="text-sm text-muted">{summarySessionText(c)}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-xl font-bold tabular-nums text-brand-700">
                  {c.session_id ? `${stat(c.present, c.total).percent}%` : '–'}
                </span>
                {c.session_id && (
                  <span className="text-sm text-muted tabular-nums">
                    {c.present}/{c.total}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {creating && units && (
        <BottomSheet
          title="Kegiatan baru"
          subtitle={`${LEVEL_LABEL[profile.unit_level]} ${profile.unit_name}`}
          onClose={() => setCreating(false)}
        >
          <ActivityForm
            initial={EMPTY_ACTIVITY}
            ownerLevel={profile.unit_level}
            ownerUnitId={profile.unit_id}
            units={units}
            templates={templates}
            submitLabel="Buat kegiatan"
            busy={create.isPending}
            error={create.error && errorMessage(create.error)}
            onSubmit={(input) => create.mutate(input)}
          />
        </BottomSheet>
      )}
    </div>
  )
}
