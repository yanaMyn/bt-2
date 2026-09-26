import { useEffect, useState } from 'react'
import { loadPageSize, PAGE_SIZES, paginate, savePageSize, type Page, type PageSize } from '../../lib/paginate'

/** Halaman aktif + ukuran halaman (diingat di perangkat); kembali ke halaman 1 saat `resetKey` berubah. */
export function usePagination<T>(
  items: readonly T[],
  resetKey: string,
): Page<T> & {
  size: PageSize
  setPage: (page: number) => void
  setSize: (size: PageSize) => void
} {
  const [page, setPage] = useState(1)
  const [size, setSizeState] = useState<PageSize>(loadPageSize)
  useEffect(() => setPage(1), [resetKey])
  const current = paginate(items, page, size)
  return {
    ...current,
    size,
    setPage,
    setSize: (s) => {
      savePageSize(s)
      setSizeState(s)
      setPage(1)
    },
  }
}

export function Pagination({
  page,
  pageCount,
  first,
  last,
  total,
  size,
  onPage,
  onSize,
}: {
  page: number
  pageCount: number
  first: number
  last: number
  total: number
  size: PageSize
  onPage: (page: number) => void
  onSize: (size: PageSize) => void
}) {
  if (total === 0) return null
  const navClass =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white px-3 font-medium ring-1 ring-gray-300 disabled:opacity-40'
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Halaman daftar">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={navClass}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>
        <span className="text-sm tabular-nums text-muted">
          {first}–{last} dari {total}
        </span>
        <button
          type="button"
          className={navClass}
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        Per halaman
        <select
          className="min-h-11 rounded-xl border border-gray-300 bg-white px-2 text-base text-ink"
          value={size}
          onChange={(e) => onSize(Number(e.target.value) as PageSize)}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </nav>
  )
}
