export const PAGE_SIZES = [10, 25, 50] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 25

export interface Page<T> {
  items: T[]
  /** Halaman aktif (1-based), sudah dijepit ke rentang yang valid. */
  page: number
  pageCount: number
  /** Nomor urut item pertama & terakhir di halaman ini (1-based); 0 bila kosong. */
  first: number
  last: number
  total: number
}

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  const start = (current - 1) * size
  const slice = items.slice(start, start + size)
  return {
    items: slice,
    page: current,
    pageCount,
    first: slice.length ? start + 1 : 0,
    last: start + slice.length,
    total,
  }
}

const STORAGE_KEY = 'admin:page-size'

/** Ukuran halaman yang diingat di perangkat; kembali ke default bila tidak ada/rusak. */
export function loadPageSize(): PageSize {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return (PAGE_SIZES as readonly number[]).includes(v) ? (v as PageSize) : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

export function savePageSize(size: PageSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(size))
  } catch {
    // abaikan; ukuran hanya berlaku untuk sesi ini
  }
}
