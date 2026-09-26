// PIN kategori yang sudah terverifikasi disimpan di perangkat (D6). Bila
// localStorage tidak tersedia (mode privat, diblokir), PIN hanya disimpan di memori.

const memory = new Map<string, string>()
const key = (categoryId: string) => `pin:${categoryId}`

export function getPin(categoryId: string): string | null {
  try {
    const v = localStorage.getItem(key(categoryId))
    if (v !== null) return v
  } catch {
    // abaikan; pakai memori
  }
  return memory.get(categoryId) ?? null
}

export function setPin(categoryId: string, pin: string): void {
  memory.set(categoryId, pin)
  try {
    localStorage.setItem(key(categoryId), pin)
  } catch {
    // abaikan; sudah tersimpan di memori
  }
}

export function clearPin(categoryId: string): void {
  memory.delete(categoryId)
  try {
    localStorage.removeItem(key(categoryId))
  } catch {
    // abaikan
  }
}
