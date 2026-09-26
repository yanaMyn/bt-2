import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { useToast } from '../../components/Toast'
import { Button, Card, ConfirmDialog, ErrorText, Field, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import type { Category, Gender, Member } from '../../lib/types'
import {
  addMemberToCategory,
  importMembers,
  listCategoryMembers,
  deleteMembers,
  listMembers,
  removeMemberFromCategory,
  removeMembersFromCategory,
} from './api'
import { BulkBar, BulkDeleteDialog, RowCheckbox, SelectAllRow, useSelection } from './bulk'
import { Pagination, usePagination } from './Pagination'
import { GenderPicker } from './GenderPicker'

const norm = (s: string) => s.trim().toLocaleLowerCase('id')

export function CategoryMembersTab({ category }: { category: Category }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['admin', 'category-members', category.id]
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: () => listCategoryMembers(category.id) })
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['summaries'] })
    void qc.invalidateQueries({ queryKey: ['category'] })
  }

  const remove = useMutation({
    mutationFn: (m: Member) => removeMemberFromCategory(category.id, m.id),
    onSuccess: (_r, m) => {
      setRemoving(null)
      refresh()
      toast({ message: `${m.name} dikeluarkan dari ${category.name}` })
    },
  })

  const filtered = useMemo(() => (data ?? []).filter((m) => norm(m.name).includes(norm(search))), [data, search])

  const selection = useSelection(useMemo(() => (data ?? []).map((m) => m.id), [data]))
  const pager = usePagination(filtered, search)
  const selectedIds = [...selection.selected]
  const [bulk, setBulk] = useState<'remove' | 'delete' | null>(null)
  const bulkRemove = useMutation({
    mutationFn: () => removeMembersFromCategory(category.id, selectedIds),
    onSuccess: (n) => {
      setBulk(null)
      selection.clear()
      refresh()
      toast({ message: `${n} orang dikeluarkan dari ${category.name}` })
    },
  })
  const bulkDelete = useMutation({
    mutationFn: () => deleteMembers(selectedIds),
    onSuccess: (n) => {
      setBulk(null)
      selection.clear()
      refresh()
      toast({ message: `${n} orang dihapus` })
    },
  })

  if (isPending) return <p className="text-muted">Memuat…</p>
  if (error) return <ErrorText>{errorMessage(error)}</ErrorText>

  return (
    <div className={`flex flex-col gap-4 ${selection.selected.size ? 'pb-24' : ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          className={inputClass}
          placeholder={`Cari di ${data.length} anggota…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari anggota"
        />
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => setAdding(true)} className="flex-1">
            + Tambah anggota
          </Button>
          <Link
            to={`/admin/import?kategori=${category.id}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white px-4 font-semibold ring-1 ring-gray-300"
          >
            Import .xlsx
          </Link>
        </div>
      </div>

      <Card className="p-0">
        {data.length === 0 ? (
          <p className="p-4 text-muted">Belum ada anggota.</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-muted">Nama tidak ditemukan.</p>
        ) : (
          <>
            <SelectAllRow
              visibleIds={filtered.map((m) => m.id)}
              selected={selection.selected}
              onToggle={() => selection.toggleAll(filtered.map((m) => m.id))}
            />
            <ul className="divide-y divide-gray-100">
              {pager.items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2">
                  <RowCheckbox
                    checked={selection.has(m.id)}
                    label={`Pilih ${m.name}`}
                    onChange={() => selection.toggle(m.id)}
                  />
                  <span className="min-w-0 flex-1 break-words">{m.name}</span>
                  <span className="w-6 text-center text-muted">{m.gender}</span>
                  <Button variant="ghost" className="text-red-700" onClick={() => setRemoving(m)}>
                    Keluarkan
                  </Button>
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
        <Button variant="secondary" onClick={() => setBulk('remove')}>
          Keluarkan dari kategori
        </Button>
        <Button variant="danger" onClick={() => setBulk('delete')}>
          Hapus orang
        </Button>
      </BulkBar>
      {bulk === 'remove' && (
        <ConfirmDialog
          title={`Keluarkan ${selectedIds.length} orang dari ${category.name}?`}
          message="Mereka tidak lagi tampil di kategori ini. Riwayat sesi yang sudah ditutup tetap ada di laporan, dan keanggotaan di kategori lain tidak berubah."
          confirmLabel={`Keluarkan ${selectedIds.length} orang`}
          danger
          busy={bulkRemove.isPending}
          error={bulkRemove.error && errorMessage(bulkRemove.error)}
          onConfirm={() => bulkRemove.mutate()}
          onClose={() => {
            setBulk(null)
            bulkRemove.reset()
          }}
        />
      )}
      {bulk === 'delete' && (
        <BulkDeleteDialog
          ids={selectedIds}
          busy={bulkDelete.isPending}
          error={bulkDelete.error ? errorMessage(bulkDelete.error) : null}
          onConfirm={() => bulkDelete.mutate()}
          onClose={() => {
            setBulk(null)
            bulkDelete.reset()
          }}
        />
      )}
      <p className="text-sm text-muted">
        Ubah nama/jenis kelamin atau hapus orang sepenuhnya di menu{' '}
        <Link to="/admin/anggota" className="text-brand-700 underline">
          Anggota
        </Link>
        .
      </p>

      {adding && (
        <AddMemberSheet
          category={category}
          existingIds={new Set(data.map((m) => m.id))}
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            refresh()
            toast({ message: `${name} ditambahkan ke ${category.name}` })
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Keluarkan ${removing.name}?`}
          message={
            <>
              {removing.name} tidak lagi tampil di <b>{category.name}</b>. Riwayat sesi yang sudah ditutup tetap ada di
              laporan, dan keanggotaannya di kategori lain tidak berubah.
            </>
          }
          confirmLabel="Keluarkan"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => {
            setRemoving(null)
            remove.reset()
          }}
        />
      )}
    </div>
  )
}

function AddMemberSheet({
  category,
  existingIds,
  onClose,
  onAdded,
}: {
  category: Category
  existingIds: Set<string>
  onClose: () => void
  onAdded: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const { data: all } = useQuery({ queryKey: ['admin', 'members'], queryFn: listMembers })

  const matches = useMemo(() => {
    const q = norm(query)
    if (!q || !all) return []
    return all.filter((m) => norm(m.name).includes(q)).slice(0, 20)
  }, [all, query])

  const link = useMutation({
    mutationFn: (m: Member) => addMemberToCategory(category.id, m.id),
    onSuccess: (_r, m) => {
      setAdded((s) => new Set(s).add(m.id))
      onAdded(m.name)
    },
  })
  const create = useMutation({
    mutationFn: () => importMembers(category.id, [{ name: query.trim(), gender: gender! }]),
    onSuccess: () => {
      onAdded(query.trim())
      setQuery('')
      setGender(null)
    },
  })

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (query.trim() && gender) create.mutate()
  }

  const linkError =
    link.error && (link.error as { code?: string }).code === '23505'
      ? 'Orang ini sudah tergabung di kategori ini.'
      : link.error && errorMessage(link.error)

  return (
    <BottomSheet title="Tambah anggota" subtitle={category.name} onClose={onClose}>
      <form onSubmit={onCreate} className="flex flex-col gap-4">
        <Field label="Nama" hint="Ketik nama untuk mencari orang yang sudah ada di kategori lain.">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              link.reset()
              create.reset()
            }}
            autoFocus
          />
        </Field>

        {matches.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Sudah ada</p>
            <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
              {matches.map((m) => {
                const inCategory = existingIds.has(m.id) || added.has(m.id)
                return (
                  <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words">
                      {m.name} <span className="text-muted">({m.gender})</span>
                    </span>
                    {inCategory ? (
                      <span className="text-sm text-muted">Sudah tergabung</span>
                    ) : (
                      <Button variant="secondary" disabled={link.isPending} onClick={() => link.mutate(m)}>
                        Tautkan
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
            <ErrorText>{linkError}</ErrorText>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3">
          <p className="font-medium">Atau buat orang baru</p>
          <GenderPicker value={gender} onChange={setGender} />
          <ErrorText>{create.error && errorMessage(create.error)}</ErrorText>
          <Button type="submit" disabled={!query.trim() || !gender || create.isPending}>
            {create.isPending ? 'Menyimpan…' : `+ Buat "${query.trim() || '…'}"`}
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
