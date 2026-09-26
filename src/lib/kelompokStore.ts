// Kelompok pilihan jamaah disimpan di perangkat agar beranda langsung membuka halamannya.
// Bila localStorage tidak tersedia (mode privat, diblokir), pilihan hanya disimpan di memori.

export interface SavedKelompok {
  id: string
  slug: string
  name: string
}

const KEY = 'kelompok'
let memory: SavedKelompok | null = null

function isSaved(v: unknown): v is SavedKelompok {
  const o = v as SavedKelompok | null
  return !!o && typeof o.id === 'string' && typeof o.slug === 'string' && typeof o.name === 'string'
}

export function getKelompok(): SavedKelompok | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const v: unknown = JSON.parse(raw)
      if (isSaved(v)) return v
    }
  } catch {
    // abaikan; pakai memori
  }
  return memory
}

export function saveKelompok(k: SavedKelompok): void {
  memory = { id: k.id, slug: k.slug, name: k.name }
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    // abaikan; sudah tersimpan di memori
  }
}

export function clearKelompok(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // abaikan
  }
}
