import type { CompareItem } from '../../lib/compare'
import { InactiveBadge } from './InactiveBadge'

/**
 * Batang horizontal % hadir per kategori (satu seri, jadi tanpa legenda).
 * Nilai ditulis di ujung batang dengan warna teks; detail angka ada di bawah nama.
 */
export function CategoryCompareChart({ items, caption }: { items: CompareItem[]; caption: string }) {
  if (items.length === 0) return <p className="text-muted">Belum ada kategori.</p>
  return (
    <figure>
      <figcaption className="mb-3 text-sm text-muted">{caption}</figcaption>
      <ul className="flex flex-col gap-4" aria-label={caption}>
        {items.map((item) => (
          <li key={item.category.id}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-semibold break-words">
                {item.category.name} {!item.category.is_active && <InactiveBadge />}
              </span>
              <span className="text-sm text-muted">
                {item.percent === null ? 'tidak ada sesi' : `${item.detail} · ${item.present}/${item.total} hadir`}
              </span>
            </div>
            {item.percent !== null && (
              <div
                className="relative flex h-6 items-center"
                title={`${item.category.name}: ${item.percent}% (${item.present}/${item.total} hadir, ${item.detail})`}
              >
                {/* Garis bantu 0 / 50 / 100 yang samar. */}
                <div className="absolute inset-y-0 left-0 w-[calc(100%-3.5rem)]" aria-hidden>
                  <span className="absolute inset-y-0 left-0 border-l border-gray-300" />
                  <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-gray-200" />
                  <span className="absolute inset-y-0 right-0 border-l border-dashed border-gray-200" />
                </div>
                {/* Area batang = lebar penuh dikurangi 3.5rem untuk label nilai di ujung batang. */}
                <div
                  className="relative h-5 rounded-r bg-brand-600"
                  style={{ width: `calc((100% - 3.5rem) * ${item.percent / 100})`, minWidth: item.percent > 0 ? 2 : 0 }}
                />
                <span className="relative pl-2 font-bold tabular-nums">{item.percent}%</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex w-[calc(100%-3.5rem)] justify-between text-xs text-muted" aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </figure>
  )
}
