import { useMediaQuery } from '@vueuse/core'

type PeekEvent = {
  iconType: 'move' | 'at' | 'build' | 'check'
  color: string
  title: string
  sub: string
  act: string
}

export function useIsland() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const open = ref(false)
  const pinned = ref(false)
  const peek = ref<PeekEvent | null>(null)
  const hovered = ref(false)

  let peekTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const islW = computed(() => {
    if (open.value) return 760
    if (peek.value) return 540
    if (hovered.value) return 480
    return 210
  })
  const islH = computed(() => open.value ? 540 : 52)
  const islR = computed(() => open.value ? 30 : 26)

  const islStyle = computed(() => {
    const base = {
      width: `${islW.value}px`,
      height: `${islH.value}px`,
      borderRadius: `${islR.value}px`,
    }
    if (reducedMotion.value) return base
    return {
      ...base,
      transition: 'width .5s cubic-bezier(.34,1.4,.5,1), height .5s cubic-bezier(.34,1.4,.5,1), border-radius .4s cubic-bezier(.4,0,.2,1)',
    }
  })

  const notchStyle = computed(() => {
    const visibility = { opacity: open.value ? '0' : '1', pointerEvents: (open.value ? 'none' : 'auto') as 'none' | 'auto' }
    if (reducedMotion.value) return visibility
    return { ...visibility, transition: 'opacity .26s cubic-bezier(.4,0,.2,1)' }
  })

  const peekStyle = computed(() => {
    const visible = !!(peek.value && !open.value)
    const visibility = { opacity: visible ? '1' : '0', pointerEvents: (visible ? 'auto' : 'none') as 'none' | 'auto' }
    if (reducedMotion.value) return visibility
    return { ...visibility, transition: 'opacity .22s cubic-bezier(.4,0,.2,1)' }
  })

  const panelStyle = computed(() => {
    const base = {
      opacity: open.value ? '1' : '0',
      transform: open.value ? 'none' : 'translateY(-6px)',
      pointerEvents: (open.value ? 'auto' : 'none') as 'none' | 'auto',
    }
    if (reducedMotion.value) return { opacity: base.opacity, pointerEvents: base.pointerEvents }
    return { ...base, transition: 'opacity .3s cubic-bezier(.4,0,.2,1) .06s, transform .3s cubic-bezier(.4,0,.2,1) .06s' }
  })

  function onPointerEnter() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
    hovered.value = true
  }

  function onPointerLeave() {
    hovered.value = false
    if (open.value && !pinned.value) {
      closeTimer = setTimeout(() => { open.value = false }, 380)
    }
  }

  function onActivate() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
    if (!open.value) open.value = true
  }

  function togglePin(e: Event) {
    e.stopPropagation()
    pinned.value = !pinned.value
  }

  function firePeek(ev: PeekEvent) {
    if (open.value) return
    if (peekTimer) clearTimeout(peekTimer)
    peek.value = ev
    peekTimer = setTimeout(() => { peek.value = null }, 3200)
  }

  onUnmounted(() => {
    if (peekTimer) clearTimeout(peekTimer)
    if (closeTimer) clearTimeout(closeTimer)
  })

  return {
    open,
    pinned,
    peek,
    hovered,
    reducedMotion,
    islStyle,
    notchStyle,
    peekStyle,
    panelStyle,
    onPointerEnter,
    onPointerLeave,
    onActivate,
    togglePin,
    firePeek,
  }
}
