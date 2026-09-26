/** Warna teks (hitam/putih) yang terbaca di atas latar hex. */
export function readableText(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#111827' : '#ffffff'
}

/** Palet preset untuk status. */
export const STATUS_COLORS = [
  '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777',
  '#dc2626', '#ea580c', '#eab308', '#64748b', '#78350f',
]
