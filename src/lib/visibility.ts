/**
 * Logika "halaman dianggap terlihat": tetap `true` selama tersembunyi kurang dari `graceMs`,
 * menjadi `false` setelahnya, dan langsung `true` lagi saat terlihat.
 */
export function createVisibilityController(graceMs: number, onChange: (visible: boolean) => void) {
  let visible = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const set = (v: boolean) => {
    if (v === visible) return
    visible = v
    onChange(v)
  }
  return {
    hidden() {
      clearTimeout(timer)
      timer = setTimeout(() => set(false), graceMs)
    },
    shown() {
      clearTimeout(timer)
      set(true)
    },
    dispose() {
      clearTimeout(timer)
    },
    get visible() {
      return visible
    },
  }
}
