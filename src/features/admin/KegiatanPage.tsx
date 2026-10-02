import { CalendarDays, ChevronRight, Lock, Plus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { Badge, Button, Card, ErrorText, LiveDot, PageHeader } from '../../components/ui'
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
      <PageHeader
        title="Kegiatan"
        description={`Kegiatan milik ${LEVEL_LABEL[profile.unit_level]} ${profile.unit_name}. Peserta dihitung otomatis dari kriteria.`}
        actions={
          <Button onClick={() => setCreating(true)} disabled={!units}>
            <Plus className="size-5" aria-hidden /> Kegiatan
          </Button>
        }
      />

      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {data && own.length === 0 && (
        <Card>
          <p className="text-muted">
            Belum ada kegiatan. Buat kegiatan dari templat (mis. Caberawit, Remaja, Ibu-ibu).
          </p>
        </Card>
      )}
      <ul className="grid gap-3">
        {own.map((c) => (
          <li key={c.category_id}>
            <Link
              to={`/admin/kegiatan/${c.category_id}`}
              className={`group flex items-center gap-4 rounded-3xl border p-4 shadow-card transition hover:shadow-float ${
                c.is_active ? 'border-line/70 bg-white' : 'border-dashed border-slate-300 bg-slate-50'
              }`}
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                  c.session_id ? 'bg-brand-600 text-white shadow-brand' : 'bg-brand-50 text-brand-600'
                }`}
              >
                <CalendarDays className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-lg font-bold break-words">{c.name}</p>
                  {c.session_id && (
                    <Badge tone="brand">
                      <LiveDot /> Berlangsung
                    </Badge>
                  )}
                  {c.pin_enabled && (
                    <Badge>
                      <Lock className="size-3" aria-hidden /> PIN
                    </Badge>
                  )}
                  {!c.is_active && <InactiveBadge />}
                </div>
                <p className="text-sm text-muted">{criteriaText(c)}</p>
                <p className="text-sm text-muted">{summarySessionText(c)}</p>
              </div>
              {c.session_id ? (
                <span className="shrink-0 text-right">
                  <span className="block text-2xl font-extrabold tabular-nums text-brand-700">
                    {stat(c.present, c.total).percent}%
                  </span>
                  <span className="text-sm text-muted tabular-nums">
                    {c.present}/{c.total}
                  </span>
                </span>
              ) : (
                <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
              )}
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
