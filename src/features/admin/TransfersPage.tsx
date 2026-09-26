import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ErrorText, Field, inputClass } from '../../components/ui'
import { ageOn, MARITAL_LABEL, unitLabel } from '../../lib/criteria'
import { formatDateShort } from '../../lib/dateRange'
import { errorMessage } from '../../lib/errors'
import { todayJakarta } from '../../lib/sessionLabel'
import type { OrgUnit } from '../../lib/types'
import { cancelTransfer, decideTransfer, listTransfers, type Transfer } from './api'
import { formatDate } from './CategorySessionsTab'
import { useProfile } from './profile'
import { useUnits } from './units'

const STATUS_LABEL: Record<Transfer['status'], string> = {
  pending: 'Menunggu',
  accepted: 'Diterima',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}

/** Nama, L/P, umur, status nikah, dan tanggal lahir jamaah dalam permintaan pindah. */
function MemberInfo({ t }: { t: Transfer }) {
  const age = ageOn(t.member_birth_date, todayJakarta())
  return (
    <>
      <span className="block text-lg font-bold break-words">{t.member_name}</span>
      <span className="block text-muted">
        {t.member_gender === 'L' ? 'Laki-laki' : 'Perempuan'} · {age === null ? 'umur belum diisi' : `${age} tahun`} ·{' '}
        {MARITAL_LABEL[t.member_marital]}
      </span>
      {t.member_birth_date && (
        <span className="block text-sm text-muted">Lahir {formatDateShort(t.member_birth_date)}</span>
      )}
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  )
}

function TransferDetails({ t, units, direction }: { t: Transfer; units: OrgUnit[]; direction: 'in' | 'out' }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {direction === 'in' ? (
        <Detail label="Dari">Kelompok {unitLabel(units, t.from_kelompok)}</Detail>
      ) : (
        <Detail label="Ke">Kelompok {unitLabel(units, t.to_kelompok)}</Detail>
      )}
      <Detail label="Dilepas">
        {formatDate(t.requested_at)}
        {t.requested_by_name && ` oleh ${t.requested_by_name}`}
      </Detail>
      {t.request_note && <Detail label="Alasan">{t.request_note}</Detail>}
    </dl>
  )
}

/** Permintaan pindah masuk (terima/tolak) dan keluar (batal) untuk admin Kelompok. */
export function TransfersPage() {
  const profile = useProfile()
  const qc = useQueryClient()
  const toast = useToast()
  const { data = [], isPending, error } = useQuery({ queryKey: ['admin', 'transfers'], queryFn: listTransfers })
  const { data: units = [] } = useUnits()
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] })
  const onError = (e: unknown) => toast({ tone: 'error', message: errorMessage(e) })
  const [rejecting, setRejecting] = useState<Transfer | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const decide = useMutation({
    mutationFn: ({ t, accept, note }: { t: Transfer; accept: boolean; note?: string }) =>
      decideTransfer(t.id, accept, note),
    onSuccess: (_r, { t, accept }) => {
      setRejecting(null)
      refresh()
      toast({ message: accept ? `${t.member_name} kini jamaah kelompok ini` : `Permintaan ${t.member_name} ditolak` })
    },
    onError,
  })
  const cancel = useMutation({
    mutationFn: (t: Transfer) => cancelTransfer(t.id),
    onSuccess: (_r, t) => {
      refresh()
      toast({ message: `Pelepasan ${t.member_name} dibatalkan` })
    },
    onError,
  })

  if (profile.unit_level !== 'kelompok') return <p className="text-muted">Perpindahan dikelola admin Kelompok.</p>
  const incoming = data.filter((t) => t.status === 'pending' && t.to_kelompok === profile.unit_id)
  const outgoing = data.filter((t) => t.status === 'pending' && t.from_kelompok === profile.unit_id)
  const history = data.filter((t) => t.status !== 'pending').slice(0, 50)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/admin/jamaah" className="inline-flex min-h-11 items-center text-brand-700">
          ‹ Jamaah
        </Link>
        <h1 className="text-2xl font-bold">Perpindahan jamaah</h1>
      </div>
      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Permintaan masuk ({incoming.length})</h2>
        {incoming.length === 0 && <p className="text-muted">Tidak ada.</p>}
        {incoming.map((t) => (
          <Card key={t.id}>
            <MemberInfo t={t} />
            <TransferDetails t={t} units={units} direction="in" />
            <p className="mt-2 text-sm text-muted">
              Bila diterima, {t.member_name} menjadi jamaah Kelompok {profile.unit_name} dan ikut kegiatan kelompok ini.
              Riwayat kehadiran di kelompok lama tetap tersimpan.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="text-red-700"
                onClick={() => {
                  setRejectNote('')
                  setRejecting(t)
                }}
                disabled={decide.isPending}
              >
                Tolak
              </Button>
              <Button onClick={() => decide.mutate({ t, accept: true })} disabled={decide.isPending}>
                Terima
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Dilepas, menunggu diterima ({outgoing.length})</h2>
        {outgoing.length === 0 && <p className="text-muted">Tidak ada.</p>}
        {outgoing.map((t) => (
          <Card key={t.id}>
            <MemberInfo t={t} />
            <TransferDetails t={t} units={units} direction="out" />
            <div className="mt-3">
              <Button variant="secondary" onClick={() => cancel.mutate(t)} disabled={cancel.isPending}>
                Batalkan
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {rejecting && (
        <BottomSheet
          title={`Tolak ${rejecting.member_name}?`}
          subtitle={`Dari Kelompok ${unitLabel(units, rejecting.from_kelompok)}`}
          onClose={() => setRejecting(null)}
        >
          <div className="flex flex-col gap-4">
            <p>{rejecting.member_name} tetap menjadi jamaah kelompok asalnya.</p>
            <Field label="Alasan ditolak (opsional)" hint="Dibaca admin kelompok asal.">
              <textarea
                className={`${inputClass} min-h-20 py-2`}
                maxLength={500}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </Field>
            <Button
              variant="danger"
              onClick={() => decide.mutate({ t: rejecting, accept: false, note: rejectNote })}
              disabled={decide.isPending}
            >
              {decide.isPending ? 'Memproses…' : 'Tolak permintaan'}
            </Button>
          </div>
        </BottomSheet>
      )}

      <Card>
        <p className="mb-2 font-bold">Riwayat</p>
        {history.length === 0 && <p className="text-muted">Belum ada.</p>}
        <ul className="divide-y divide-gray-100 text-sm">
          {history.map((t) => (
            <li key={t.id} className="py-2">
              <b>{t.member_name}</b>: {unitLabel(units, t.from_kelompok)} → {unitLabel(units, t.to_kelompok)} ·{' '}
              {STATUS_LABEL[t.status]}
              {t.decided_at && ` · ${formatDate(t.decided_at)}`}
              {t.decided_by_name && ` oleh ${t.decided_by_name}`}
              {t.request_note && <span className="block text-muted">Alasan pindah: {t.request_note}</span>}
              {t.decision_note && <span className="block text-muted">Alasan ditolak: {t.decision_note}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
