import { ArrowLeftRight, Plus, Upload } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, buttonClass, Card, ConfirmDialog, ErrorText, Field, inputClass, PageHeader } from '../../components/ui'
import { ageOn, childrenOf, MARITAL_LABEL, unitLabel } from '../../lib/criteria'
import { formatDateShort } from '../../lib/dateRange'
import { errorMessage } from '../../lib/errors'
import { DEFAULT_FILTER, filterJamaah, type JamaahFilter, type JamaahStatusFilter } from '../../lib/jamaahFilter'
import { todayJakarta } from '../../lib/sessionLabel'
import type { Gender, Jamaah, Marital, OrgUnit } from '../../lib/types'
import {
  createJamaah,
  deleteJamaah,
  listJamaah,
  listTransfers,
  requestTransfer,
  setJamaahActive,
  updateJamaah,
  type JamaahInput,
} from './api'
import { BulkBar, RowCheckbox, SelectAllRow, useSelection } from './bulk'
import { GenderPicker } from './GenderPicker'
import { Pagination, usePagination } from './Pagination'
import { useProfile } from './profile'
import { useUnits } from './units'

const REASONS = [
  ['meninggal', 'Meninggal'],
  ['pindah_luar', 'Pindah ke luar daerah'],
  ['lainnya', 'Lainnya'],
] as const

const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS)

export function JamaahPage() {
  const profile = useProfile()
  const canEdit = profile.unit_level === 'kelompok'
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const filter: JamaahFilter = {
    ...DEFAULT_FILTER,
    search,
    desa: params.get('desa') ?? '',
    kelompok: params.get('kelompok') ?? '',
    status: (params.get('status') as JamaahStatusFilter) || 'aktif',
    incomplete: params.get('lengkap') === 'belum',
  }
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'desa') next.delete('kelompok')
    setParams(next, { replace: true })
  }

  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'jamaah'], queryFn: listJamaah })
  const { data: units = [] } = useUnits()
  const { data: transfers = [] } = useQuery({ queryKey: ['admin', 'transfers'], queryFn: listTransfers })
  const pending = useMemo(
    () => new Map(transfers.filter((t) => t.status === 'pending').map((t) => [t.member_id, t])),
    [transfers],
  )
  const pendingIds = useMemo(() => new Set(pending.keys()), [pending])
  const filtered = useMemo(
    () => filterJamaah(data ?? [], filter, units, pendingIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, units, pendingIds, search, params],
  )
  const selection = useSelection(useMemo(() => filtered.map((m) => m.id), [filtered]))
  const pager = usePagination(filtered, `${search}|${params.toString()}`)
  const today = todayJakarta()

  const [editing, setEditing] = useState<Jamaah | 'new' | null>(null)
  const [moving, setMoving] = useState<Jamaah | null>(null)
  const [deactivating, setDeactivating] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState<string[] | null>(null)
  const incomingCount = transfers.filter((t) => t.status === 'pending' && t.to_kelompok === profile.unit_id).length

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] })

  const reactivate = useMutation({
    mutationFn: (m: Jamaah) => setJamaahActive([m.id], true),
    onSuccess: (_r, m) => {
      refresh()
      toast({ message: `${m.name} diaktifkan kembali` })
    },
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })
  const remove = useMutation({
    mutationFn: (ids: string[]) => deleteJamaah(ids),
    onSuccess: (r) => {
      setDeleting(null)
      selection.clear()
      refresh()
      toast({
        message:
          r.skipped.length > 0
            ? `${r.deleted} jamaah dihapus; ${r.skipped.length} dilewati karena punya riwayat (gunakan Nonaktifkan)`
            : `${r.deleted} jamaah dihapus`,
      })
    },
  })

  // Pilihan filter desa/kelompok sesuai cakupan.
  const desaOptions = profile.unit_level === 'daerah' ? childrenOf(units, profile.unit_id) : []
  const kelompokOptions =
    profile.unit_level === 'daerah'
      ? filter.desa
        ? childrenOf(units, filter.desa)
        : units.filter((u) => u.level === 'kelompok')
      : profile.unit_level === 'desa'
        ? childrenOf(units, profile.unit_id)
        : []

  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>

  return (
    <div className={`flex flex-col gap-4 ${selection.selected.size ? 'pb-24' : ''}`}>
      <PageHeader
        title="Jamaah"
        description={
          canEdit
            ? `Jamaah Kelompok ${profile.unit_name}. Peserta kegiatan dihitung otomatis dari data ini.`
            : 'Hanya dapat dilihat. Data jamaah dikelola admin Kelompok masing-masing.'
        }
        actions={
          canEdit && (
            <>
              <Button onClick={() => setEditing('new')}>
                <Plus className="size-5" aria-hidden /> Jamaah
              </Button>
              <Link to="/admin/jamaah/import" className={buttonClass('secondary')}>
                <Upload className="size-5" aria-hidden /> Import
              </Link>
              <Link to="/admin/perpindahan" className={buttonClass('secondary')}>
                <ArrowLeftRight className="size-5" aria-hidden /> Perpindahan
                {incomingCount > 0 && (
                  <span className="rounded-full bg-red-600 px-2 text-sm text-white">{incomingCount}</span>
                )}
              </Link>
            </>
          )
        }
      />

      <Card className="flex flex-col gap-2">
        <input
          type="search"
          className={inputClass}
          placeholder={`Cari di ${data.length} jamaah…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari jamaah"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {desaOptions.length > 0 && (
            <select
              className={inputClass}
              value={filter.desa}
              onChange={(e) => setParam('desa', e.target.value)}
              aria-label="Filter desa"
            >
              <option value="">Semua desa</option>
              {desaOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  Desa {u.name}
                </option>
              ))}
            </select>
          )}
          {kelompokOptions.length > 0 && (
            <select
              className={inputClass}
              value={filter.kelompok}
              onChange={(e) => setParam('kelompok', e.target.value)}
              aria-label="Filter kelompok"
            >
              <option value="">Semua kelompok</option>
              {kelompokOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(units, u.id)}
                </option>
              ))}
            </select>
          )}
          <select
            className={inputClass}
            value={filter.status}
            onChange={(e) => setParam('status', e.target.value === 'aktif' ? '' : e.target.value)}
            aria-label="Filter status"
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
            <option value="menunggu">Menunggu pindah</option>
            <option value="semua">Semua status</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-700"
            checked={filter.incomplete}
            onChange={(e) => setParam('lengkap', e.target.checked ? 'belum' : '')}
          />
          Hanya data belum lengkap (tanpa tanggal lahir — tidak masuk kegiatan berbatas umur)
        </label>
      </Card>

      <Card className="p-0">
        {filtered.length === 0 ? (
          <p className="p-4 text-muted">{data.length === 0 ? 'Belum ada jamaah.' : 'Tidak ada jamaah yang cocok.'}</p>
        ) : (
          <>
            {canEdit && (
              <SelectAllRow
                visibleIds={filtered.map((m) => m.id)}
                selected={selection.selected}
                onToggle={() => selection.toggleAll(filtered.map((m) => m.id))}
              />
            )}
            <ul className="divide-y divide-slate-100">
              {pager.items.map((m) => {
                const t = pending.get(m.id)
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                    {canEdit && (
                      <RowCheckbox
                        checked={selection.has(m.id)}
                        label={`Pilih ${m.name}`}
                        onChange={() => selection.toggle(m.id)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-words">
                        {m.name} <span className="text-muted">({m.gender})</span>
                      </p>
                      <p className="text-sm text-muted">
                        {m.birth_date ? `${ageOn(m.birth_date, today)} th` : 'Tgl lahir kosong'} ·{' '}
                        {MARITAL_LABEL[m.marital_status]}
                        {!canEdit && ` · ${unitLabel(units, m.kelompok_id)}`}
                      </p>
                      {m.inactive_since && (
                        <p className="text-sm font-medium text-slate-700">
                          Nonaktif sejak {formatDateShort(m.inactive_since)} ({REASON_LABEL[m.inactive_reason ?? '']})
                        </p>
                      )}
                      {t && (
                        <p className="text-sm font-medium text-yellow-800">
                          Menunggu diterima{' '}
                          {t.from_kelompok === m.kelompok_id ? `Kelompok ${unitLabel(units, t.to_kelompok)}` : ''}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-1">
                        <Button variant="secondary" onClick={() => setEditing(m)}>
                          Ubah
                        </Button>
                        {!m.inactive_since && !t && (
                          <>
                            <Button variant="ghost" onClick={() => setMoving(m)}>
                              Pindahkan
                            </Button>
                            <Button variant="ghost" onClick={() => setDeactivating([m.id])}>
                              Nonaktifkan
                            </Button>
                          </>
                        )}
                        {m.inactive_since && (
                          <Button variant="ghost" onClick={() => reactivate.mutate(m)} disabled={reactivate.isPending}>
                            Aktifkan
                          </Button>
                        )}
                        <Button variant="ghost" className="text-red-700" onClick={() => setDeleting([m.id])}>
                          Hapus
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>

      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        first={pager.first}
        last={pager.last}
        total={pager.total}
        size={pager.size}
        onPage={pager.setPage}
        onSize={pager.setSize}
      />

      {canEdit && (
        <BulkBar count={selection.selected.size} onClear={selection.clear}>
          <Button variant="secondary" onClick={() => setDeactivating([...selection.selected])}>
            Nonaktifkan
          </Button>
          <Button variant="danger" onClick={() => setDeleting([...selection.selected])}>
            Hapus
          </Button>
        </BulkBar>
      )}

      {editing && (
        <JamaahFormSheet
          jamaah={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            refresh()
            toast({ message: `${name} disimpan` })
          }}
        />
      )}
      {moving && (
        <TransferSheet
          jamaah={moving}
          units={units}
          myKelompok={profile.unit_id}
          onClose={() => setMoving(null)}
          onDone={(to) => {
            setMoving(null)
            refresh()
            toast({ message: `${moving.name} dilepas ke Kelompok ${to}. Menunggu diterima.` })
          }}
        />
      )}
      {deactivating && (
        <InactiveSheet
          ids={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={(n) => {
            setDeactivating(null)
            selection.clear()
            refresh()
            toast({ message: `${n} jamaah dinonaktifkan` })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus ${deleting.length} jamaah?`}
          message="Hanya jamaah tanpa riwayat kehadiran/perpindahan yang dihapus permanen (mis. salah input atau salah import). Jamaah yang punya riwayat dilewati — gunakan Nonaktifkan untuk mereka."
          confirmLabel="Hapus"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate(deleting)}
          onClose={() => {
            setDeleting(null)
            remove.reset()
          }}
        />
      )}
    </div>
  )
}

function JamaahFormSheet({
  jamaah,
  onClose,
  onSaved,
}: {
  jamaah: Jamaah | null
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(jamaah?.name ?? '')
  const [gender, setGender] = useState<Gender | null>(jamaah?.gender ?? null)
  const [birth, setBirth] = useState(jamaah?.birth_date ?? '')
  const [marital, setMarital] = useState<Marital>(jamaah?.marital_status ?? 'belum')
  const save = useMutation({
    mutationFn: () => {
      const input: JamaahInput = { name, gender: gender!, birth_date: birth || null, marital_status: marital }
      return jamaah ? updateJamaah(jamaah.id, input) : createJamaah(input)
    },
    onSuccess: () => onSaved(name.trim()),
  })
  return (
    <BottomSheet title={jamaah ? 'Ubah jamaah' : 'Jamaah baru'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() && gender) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Nama">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <GenderPicker value={gender} onChange={setGender} />
        <Field label="Tanggal lahir" hint="Dipakai untuk kegiatan berbatas umur (Caberawit, Remaja, Lansia, …).">
          <input
            type="date"
            className={inputClass}
            max={todayJakarta()}
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
          />
        </Field>
        <Field label="Status nikah">
          <select className={inputClass} value={marital} onChange={(e) => setMarital(e.target.value as Marital)}>
            {(Object.keys(MARITAL_LABEL) as Marital[]).map((k) => (
              <option key={k} value={k}>
                {MARITAL_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!name.trim() || !gender || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
    </BottomSheet>
  )
}

function TransferSheet({
  jamaah,
  units,
  myKelompok,
  onClose,
  onDone,
}: {
  jamaah: Jamaah
  units: OrgUnit[]
  myKelompok: string
  onClose: () => void
  onDone: (toName: string) => void
}) {
  const desa = units.filter((u) => u.level === 'desa').sort((a, b) => a.name.localeCompare(b.name, 'id'))
  const [desaId, setDesaId] = useState(units.find((u) => u.id === myKelompok)?.parent_id ?? '')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const options = childrenOf(units, desaId).filter((u) => u.id !== myKelompok)
  const save = useMutation({
    mutationFn: () => requestTransfer(jamaah.id, to, note),
    onSuccess: () => onDone(unitLabel(units, to)),
  })
  return (
    <BottomSheet title={`Pindahkan ${jamaah.name}`} subtitle="Kelompok tujuan perlu menerima" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Desa tujuan">
          <select
            className={inputClass}
            value={desaId}
            onChange={(e) => {
              setDesaId(e.target.value)
              setTo('')
            }}
          >
            {desa.map((u) => (
              <option key={u.id} value={u.id}>
                Desa {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kelompok tujuan">
          <select className={inputClass} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— Pilih kelompok —</option>
            {options.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alasan pindah (opsional)" hint="Dibaca admin kelompok tujuan, mis. menikah, pindah rumah.">
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <p className="text-sm text-muted">
          Selama belum diterima, {jamaah.name} tetap jamaah kelompok ini. Anda bisa membatalkan dari menu Perpindahan.
        </p>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button onClick={() => save.mutate()} disabled={!to || save.isPending}>
          {save.isPending ? 'Mengirim…' : 'Lepas ke kelompok tujuan'}
        </Button>
      </div>
    </BottomSheet>
  )
}

function InactiveSheet({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (n: number) => void }) {
  const [since, setSince] = useState(todayJakarta())
  const [reason, setReason] = useState<string>('meninggal')
  const save = useMutation({ mutationFn: () => setJamaahActive(ids, false, since, reason), onSuccess: onDone })
  return (
    <BottomSheet title={`Nonaktifkan ${ids.length} jamaah`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Alasan">
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Nonaktif sejak"
          hint="Tidak muncul di sesi bertanggal ini dan sesudahnya. Riwayat lama tetap ada."
        >
          <input type="date" className={inputClass} value={since} onChange={(e) => setSince(e.target.value)} />
        </Field>
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button onClick={() => save.mutate()} disabled={!since || save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Nonaktifkan'}
        </Button>
      </div>
    </BottomSheet>
  )
}
