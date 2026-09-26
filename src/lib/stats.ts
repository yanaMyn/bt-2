export type Gender = 'L' | 'P'

export interface Stat {
  present: number
  total: number
  /** Dibulatkan ke bilangan bulat terdekat; 0 bila total 0. */
  percent: number
}

export interface Stats {
  all: Stat
  L: Stat
  P: Stat
}

export function percent(present: number, total: number): number {
  return total === 0 ? 0 : Math.round((present / total) * 100)
}

export function stat(present: number, total: number): Stat {
  return { present, total, percent: percent(present, total) }
}

/**
 * Persentase hadir: anggota yang statusnya dihitung hadir dibagi seluruh anggota.
 * Anggota tanpa status (belum diisi) tetap masuk penyebut.
 */
export function computeStats(
  members: readonly { id: string; gender: Gender }[],
  statusByMember: ReadonlyMap<string, string>,
  presentStatusIds: ReadonlySet<string>,
): Stats {
  const count = { all: [0, 0], L: [0, 0], P: [0, 0] }
  for (const m of members) {
    const status = statusByMember.get(m.id)
    const isPresent = status !== undefined && presentStatusIds.has(status) ? 1 : 0
    count.all[0] += isPresent
    count.all[1] += 1
    count[m.gender][0] += isPresent
    count[m.gender][1] += 1
  }
  return {
    all: stat(count.all[0], count.all[1]),
    L: stat(count.L[0], count.L[1]),
    P: stat(count.P[0], count.P[1]),
  }
}
