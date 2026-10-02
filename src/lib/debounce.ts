export interface Debouncer {
  /** Jadwalkan panggilan; pemicu berikutnya dalam `wait` ms menunda lagi (dibatasi `maxWait`). */
  trigger: () => void
  /** Panggil sekarang bila ada yang tertunda. */
  flush: () => void
  /** Batalkan panggilan yang tertunda. */
  cancel: () => void
}

/**
 * Gabungkan rentetan pemicu menjadi satu panggilan `fn` setelah `wait` ms tanpa pemicu baru.
 * Bila pemicu terus berdatangan, `fn` tetap dipanggil paling lambat `maxWait` ms sejak pemicu
 * pertama rentetan itu.
 */
export function createDebouncer(fn: () => void, { wait, maxWait }: { wait: number; maxWait?: number }): Debouncer {
  let timer: ReturnType<typeof setTimeout> | undefined
  let firstAt: number | null = null

  const run = () => {
    clearTimeout(timer)
    timer = undefined
    firstAt = null
    fn()
  }

  return {
    trigger() {
      const now = Date.now()
      if (firstAt === null) firstAt = now
      clearTimeout(timer)
      const untilMax = maxWait === undefined ? wait : Math.max(0, firstAt + maxWait - now)
      timer = setTimeout(run, Math.min(wait, untilMax))
    },
    flush() {
      if (firstAt !== null) run()
    },
    cancel() {
      clearTimeout(timer)
      timer = undefined
      firstAt = null
    },
  }
}
