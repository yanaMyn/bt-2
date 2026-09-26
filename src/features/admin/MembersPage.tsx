import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { filterMembers, matchesCategory, NO_CATEGORY } from '../../lib/memberFilter'
import type { Gender } from '../../lib/types'
import {
  deleteMember,
  deleteMembers,
  listCategories,
  listMembers,
  memberHistoryCount,
  updateMember,
  type MemberWithCategories,
} from './api'
import { BulkBar, BulkDeleteDialog, RowCheckbox, SelectAllRow, useSelection } from './bulk'
import { Pagination, usePagination } from './Pagination'
import { GenderPicker } from './GenderPicker'

export function MembersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'members'], queryFn: listMembers })
  const { data: categories } = useQuery({ queryKey: ['admin', 'category-list'], queryFn: listCategories })
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const categoryFilter = params.get('kategori') ?? ''
  const [editing, setEditing] = useState<MemberWithCategories | null>(null)
  const [deleting, setDeleting] = useState<{ member: MemberWithCategories; history: number } | null>(null)

  const catName = useMemo(() => new Map(categories?.map((c) => [c.id, c.name])), [categories])
  const filtered = useMemo(() => filterMembers(data ?? [], search, categoryFilter), [data, search, categoryFilter])
  // Centang orang di luar filter kategori dilepas agar aksi massal tidak mengenai orang yang tidak terlihat.
  const selection = useSelection(
    useMemo(
      () => (data ?? []).filter((m) => matchesCategory(m, categoryFilter)).map((m) => m.id),
      [data, categoryFilter],
    ),
  )
  const pager = usePagination(filtered, `${search}|${categoryFilter}`)
  const [bulkDeleting, setBulkDeleting] = useState(false)

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
  const bulkDelete = useMutation({
    mutationFn: () => deleteMembers([...selection.selected]),
    onSuccess: (n) => {
      setBulkDeleting(false)
      selection.clear()
      refresh()
      toast({ message: `${n} orang dihapus` })
    },
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
    <div className={`flex flex-col gap-4 ${selection.selected.size ? 'pb-24' : ''}`}>
      <div>
        <h1 className="text-2xl font-bold">Anggota</h1>
        <p className="text-muted">
          Semua orang di semua kategori. Tambahkan orang ke kategori dari halaman kategori atau lewat Import.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          className={inputClass}
          placeholder={`Cari di ${data.length} orang…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari orang"
        />
        <select
          className={`${inputClass} sm:max-w-64`}
          value={categoryFilter}
          onChange={(e) => setParams(e.target.value ? { kategori: e.target.value } : {}, { replace: true })}
          aria-label="Filter kategori"
        >
          <option value="">Semua kategori</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? '' : ' (nonaktif)'}
            </option>
          ))}
          <option value={NO_CATEGORY}>Tidak di kategori mana pun</option>
        </select>
      </div>
      <Card className="p-0">
        {filtered.length === 0 ? (
          <p className="p-4 text-muted">
            {data.length === 0 ? 'Belum ada data orang.' : 'Tidak ada orang yang cocok dengan pencarian/filter.'}
          </p>
        ) : (
          <>
            <SelectAllRow
              visibleIds={filtered.map((m) => m.id)}
              selected={selection.selected}
              onToggle={() => selection.toggleAll(filtered.map((m) => m.id))}
            />
            <ul className="divide-y divide-gray-100">
              {pager.items.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <RowCheckbox
                    checked={selection.has(m.id)}
                    label={`Pilih ${m.name}`}
                    onChange={() => selection.toggle(m.id)}
                  />
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

      <BulkBar count={selection.selected.size} onClear={selection.clear}>
        <Button variant="danger" onClick={() => setBulkDeleting(true)}>
          Hapus orang
        </Button>
      </BulkBar>
      {bulkDeleting && (
        <BulkDeleteDialog
          ids={[...selection.selected]}
          busy={bulkDelete.isPending}
          error={bulkDelete.error ? errorMessage(bulkDelete.error) : null}
          onConfirm={() => bulkDelete.mutate()}
          onClose={() => {
            setBulkDeleting(false)
            bulkDelete.reset()
          }}
        />
      )}

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
