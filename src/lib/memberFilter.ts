/** Nilai filter untuk orang yang tidak tergabung di kategori mana pun. */
export const NO_CATEGORY = 'tanpa-kategori'

const norm = (s: string) => s.trim().toLocaleLowerCase('id')

/** '' = semua kategori, NO_CATEGORY = tanpa kategori, selain itu id kategori. */
export function matchesCategory(member: { category_ids: readonly string[] }, category: string): boolean {
  if (!category) return true
  if (category === NO_CATEGORY) return member.category_ids.length === 0
  return member.category_ids.includes(category)
}

export function filterMembers<T extends { name: string; category_ids: readonly string[] }>(
  members: readonly T[],
  search: string,
  category: string,
): T[] {
  const q = norm(search)
  return members.filter((m) => matchesCategory(m, category) && norm(m.name).includes(q))
}
