const ACCENT_VARS = ['--color-accent-700', '--color-accent-500', '--color-accent-400'] as const

export function useBrandPalette() {
  const palette = ref<string[]>([])

  onMounted(() => {
    const cs = getComputedStyle(document.documentElement)
    const next = ACCENT_VARS.map(v => cs.getPropertyValue(v).trim()).filter(Boolean)
    if (next.length) palette.value = next
  })

  return palette
}
