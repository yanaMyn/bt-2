import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Card, ErrorText, inputClass } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { stat } from '../../lib/stats'
import { createCategory, listCategorySummaries } from './api'
import { InactiveBadge } from './InactiveBadge'

export function CategoriesPage() {
  const qc = useQueryClient()
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'categories'], queryFn: listCategorySummaries })
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: (n: string) => createCategory(n),
    onSuccess: () => {
      setName('')
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['summaries'] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) create.mutate(name.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Kategori</h1>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="new-category">
            Nama kategori baru
          </label>
          <input
            id="new-category"
            className={inputClass}
            placeholder="Nama kategori baru, mis. Kelas A"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              create.reset()
            }}
          />
          <Button type="submit" disabled={!name.trim() || create.isPending} className="shrink-0">
            {create.isPending ? 'Menyimpan…' : '+ Tambah'}
          </Button>
        </form>
        <div className="mt-2">
          <ErrorText>{create.error && errorMessage(create.error)}</ErrorText>
        </div>
        <p className="mt-1 text-sm text-muted">Kategori baru otomatis mendapat status Hadir, Izin, Sakit, dan Alpa.</p>
      </Card>

      {isPending && <p className="text-muted">Memuat…</p>}
      <ErrorText>{error && errorMessage(error)}</ErrorText>
      {data?.length === 0 && <p className="text-muted">Belum ada kategori.</p>}
      <ul className="flex flex-col gap-2">
        {data?.map((c) => (
          <li key={c.category_id}>
            <Link
              to={`/admin/kategori/${c.category_id}`}
              className={`flex items-center justify-between gap-3 rounded-2xl p-4 shadow-sm ring-1 ring-black/5 hover:ring-brand-500 ${
                c.is_active ? 'bg-white' : 'bg-gray-100'
              }`}
            >
              <div className="min-w-0">
                <p className="font-bold break-words">
                  {c.name} {c.pin_enabled && <span title="PIN aktif">🔒</span>} {!c.is_active && <InactiveBadge />}
                </p>
                <p className="text-sm text-muted">
                  {c.total} anggota · {c.session_label}
                </p>
              </div>
              <span className="shrink-0 text-xl font-bold tabular-nums text-brand-700">
                {stat(c.present, c.total).percent}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
