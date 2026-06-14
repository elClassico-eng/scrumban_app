import type { Ref } from 'vue'

export function useReveal(rootRef: Ref<HTMLElement | null>) {
  let io: IntersectionObserver | null = null
  let failTimer: ReturnType<typeof setTimeout> | undefined

  onMounted(() => {
    const root = rootRef.value
    if (!root) return
    root.classList.add('is-js')

    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal, .line-mask'))
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach(el => io!.observe(el))

    requestAnimationFrame(() => {
      els.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) el.classList.add('in')
      })
    })

    failTimer = setTimeout(() => els.forEach(el => el.classList.add('in')), 1500)
  })

  onBeforeUnmount(() => {
    io?.disconnect()
    if (failTimer) clearTimeout(failTimer)
  })
}