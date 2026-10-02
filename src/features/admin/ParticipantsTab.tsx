import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Card, ErrorText, Field, inputClass } from '../../components/ui'
import { ageOn, criteriaText, hasAgeLimit, unitLabel } from '../../lib/criteria'
import { errorMessage } from '../../lib/errors'
import { todayJakarta } from '../../lib/sessionLabel'
import type { Category } from '../../lib/types'
import { listJamaah, listParticipantIds } from './api'
import { useUnits } from './units'

const norm = (s: string) => s.trim().toLocaleLowerCase('id')

/** Daftar peserta terhitung pada tanggal tertentu (read-only); peserta tidak diinput manual. */
export function ParticipantsTab({ category }: { category: Category }) {
  const [on, setOn] = useState(todayJakarta())
  const [search, setSearch] = useState('')
  const { data: units } = useUnits()
  const ids = useQuery({
    queryKey: ['admin', 'participants', category.id, on],
    queryFn: () => listParticipantIds(category.id, on),
  })
  const jamaah = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })

  const rows = useMemo(() => {
    const byId = new Map((jamaah.data ?? []).map((m) => [m.id, m]))
    return (ids.data ?? [])
      .map((p) => byId.get(p.member_id))
      .filter((m) => m !== undefined)
      .filter((m) => norm(m.name).includes(norm(search)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
  }, [ids.data, jamaah.data, search])

  const incomplete = hasAgeLimit(category)
    ? (jamaah.data ?? []).filter((m) => !m.birth_date && !m.inactive_since).length
    : 0

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p>
          <b>Kriteria:</b> {criteriaText(category)}
        </p>
        <p className="text-sm text-muted">
          Peserta dihitung otomatis dari jamaah {category.scope_all ? 'seluruh wilayah' : 'wilayah terpilih'} yang
          memenuhi kriteria. Ubah kriteria/wilayah di tab Pengaturan; jamaah dikelola admin Kelompok.
        </p>
        {incomplete > 0 && (
          <p className="rounded-xl bg-yellow-50 p-3 text-sm ring-1 ring-yellow-200">
            {incomplete} jamaah dalam cakupan Anda belum punya tanggal lahir, sehingga tidak masuk kegiatan berbatas
            umur ini.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Peserta pada tanggal">
            <input
              type="date"
              className={inputClass}
              value={on}
              onChange={(e) => e.target.value && setOn(e.target.value)}
            />
          </Field>
          <Field label="Cari nama">
            <input type="search" className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
      </Card>
      <ErrorText>{(ids.error || jamaah.error) && errorMessage(ids.error ?? jamaah.error)}</ErrorText>
      {(ids.isPending || jamaah.isPending) && <p className="text-muted">Memuat…</p>}
      {ids.data && jamaah.data && (
        <Card className="p-0">
          <p className="border-b border-slate-100 p-3 font-bold">{ids.data.length} peserta</p>
          {rows.length === 0 ? (
            <p className="p-4 text-muted">Tidak ada peserta.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1 break-words">
                    {m.name} <span className="text-muted">({m.gender})</span>
                  </span>
                  <span className="text-sm text-muted">
                    {ageOn(m.birth_date, on) ?? '–'} th · {unitLabel(units ?? [], m.kelompok_id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
