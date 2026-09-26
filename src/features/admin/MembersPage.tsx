import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import type { Gender } from '../../lib/types'
import { deleteMember, listCategories, listMembers, memberHistoryCount, updateMember, type MemberWithCategories } from './api'
import { GenderPicker } from './GenderPicker'

const norm = (s: string) => s.trim().toLocaleLowerCase('id')

export function MembersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'members'], queryFn: listMembers })
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MemberWithCategories | null>(null)
  const [deleting, setDeleting] = useState<{ member: MemberWithCategories; history: number } | null>(null)

  const catName = useMemo(() => new Map(categories?.map((c) => [c.id, c.name])), [categories])
  const filtered = useMemo(() => (data ?? []).filter((m) => norm(m.name).includes(norm(search))), [data, search])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  const checkDelete = useMutation({
    mutationFn: async (m: MemberWithCategories) => ({ member: m, history: await memberHistoryCount(m.id) }),
    onSuccess: setDeleting,
    onError: (e) => toast({ tone: 'error', message: errorMessage(e) }),
  })
  const remove = useMutation({
    mutationFn: (m: MemberWithCategories) => deleteMember(m.id),
    onSuccess: (_r, m) => {
      setDeleting(null)
      refresh()
      toast({ message: `${m.name} dihapus` })
    },
  })

  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Anggota</h1>
        <p className="text-muted">
          Semua orang di semua kategori. Tambahkan orang ke kategori dari halaman kategori atau lewat Import.
        </p>
      </div>
      <input
        type="search"
        className={inputClass}
        placeholder={`Cari di ${data.length} orang…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Cari orang"
      />
      <Card className="p-0">
        {filtered.length === 0 ? (
          <p className="p-4 text-muted">{data.length === 0 ? 'Belum ada data orang.' : 'Nama tidak ditemukan.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words">
                    {m.name} <span className="text-muted">({m.gender})</span>
                  </p>
                  <p className="text-sm text-muted">
                    {m.category_ids.length
                      ? m.category_ids.map((id) => catName.get(id) ?? '…').join(', ')
                      : 'Tidak di kategori mana pun'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="secondary" onClick={() => setEditing(m)}>
                    Ubah
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-700"
                    disabled={checkDelete.isPending}
                    onClick={() => checkDelete.mutate(m)}
                  >
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <EditMemberSheet
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
            toast({ message: 'Data orang disimpan' })
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Hapus ${deleting.member.name}?`}
          message={
            deleting.history > 0 ? (
              <>
                Orang ini punya <b>{deleting.history} catatan kehadiran</b>. Menghapusnya akan menghapus semua catatan
                tersebut dari seluruh kategori dan laporan. Bila hanya ingin mengeluarkan dari satu kategori, gunakan
                "Keluarkan" di halaman kategori.
              </>
            ) : (
              <>Orang ini akan dihapus dari semua kategori.</>
            )
          }
          typeToConfirm={deleting.history > 0 ? deleting.member.name : undefined}
          confirmLabel="Hapus orang"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate(deleting.member)}
          onClose={() => {
            setDeleting(null)
            remove.reset()
          }}
        />
      )}
    </div>
  )
}

function EditMemberSheet({
  member,
  onClose,
  onSaved,
}: {
  member: MemberWithCategories
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(member.name)
  const [gender, setGender] = useState<Gender>(member.gender)
  const save = useMutation({ mutationFn: () => updateMember(member.id, { name, gender }), onSuccess: onSaved })
  return (
    <BottomSheet title="Ubah data orang" subtitle="Berlaku di semua kategori" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Nama">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <GenderPicker value={gender} onChange={setGender} />
        <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          Simpan
        </Button>
      </form>
    </BottomSheet>
  )
}
