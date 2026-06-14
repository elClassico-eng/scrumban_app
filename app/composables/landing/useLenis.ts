import Lenis from 'lenis'

export function useLenis() {
  let lenis: Lenis | null = null
  let raf = 0
  const cleanups: Array<() => void> = []

  onMounted(() => {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.09 })
    const loop = (time: number) => {
      lenis?.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
      const onClick = (event: Event) => {
        const id = anchor.getAttribute('href')
        if (!id || id.length < 2) return
        const target = document.querySelector<HTMLElement>(id)
        if (!target) return
        event.preventDefault()
        lenis?.scrollTo(target, { offset: -10 })
      }
      anchor.addEventListener('click', onClick)
      cleanups.push(() => anchor.removeEventListener('click', onClick))
    })
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    cleanups.forEach(fn => fn())
    lenis?.destroy()
  })
}