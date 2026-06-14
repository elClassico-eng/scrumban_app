import type { Ref } from 'vue'

export function useWordmarkFit(elRef: Ref<HTMLElement | null>) {
  let delayTimer: ReturnType<typeof setTimeout> | undefined

  const fit = () => {
    const el = elRef.value
    if (!el) return
    const span = el.querySelector<HTMLElement>('.fit')
    if (!span) return
    el.style.fontSize = '100px'
    const width = span.getBoundingClientRect().width
    const target = el.clientWidth
    if (width > 0) el.style.fontSize = `${(100 * (target / width) * 0.995).toFixed(2)}px`
  }

  onMounted(() => {
    fit()
    window.addEventListener('resize', fit)
    if (document.fonts?.ready) document.fonts.ready.then(fit)
    delayTimer = setTimeout(fit, 300)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', fit)
    if (delayTimer) clearTimeout(delayTimer)
  })
}