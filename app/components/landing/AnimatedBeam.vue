<script setup lang="ts">
const props = withDefaults(defineProps<{
  container: HTMLElement | null | undefined
  from: HTMLElement | null | undefined
  to: HTMLElement | null | undefined
  curvature?: number
  duration?: number
  delay?: number
}>(), { curvature: 0, duration: 4, delay: 0 })

const path = ref('')
const width = ref(0)
const height = ref(0)

function update() {
  const box = props.container
  const a = props.from
  const b = props.to
  if (!box || !a || !b) return

  const cr = box.getBoundingClientRect()
  width.value = cr.width
  height.value = cr.height

  const ar = a.getBoundingClientRect()
  const br = b.getBoundingClientRect()
  const sx = ar.left - cr.left + ar.width / 2
  const sy = ar.top - cr.top + ar.height / 2
  const ex = br.left - cr.left + br.width / 2
  const ey = br.top - cr.top + br.height / 2
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2 - props.curvature

  path.value = `M ${sx},${sy} Q ${mx},${my} ${ex},${ey}`
}

let observer: ResizeObserver | null = null
onMounted(() => {
  update()
  observer = new ResizeObserver(update)
  if (props.container) observer.observe(props.container)
  window.addEventListener('resize', update, { passive: true })
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', update)
})
watch(() => [props.container, props.from, props.to], update)
</script>

<template>
  <svg
    class="beam" :width="width" :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    fill="none" preserveAspectRatio="none" aria-hidden="true"
  >
    <path :d="path" class="beam__base" pathLength="1" />
    <path
      :d="path" class="beam__flow" pathLength="1"
      :style="{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }"
    />
  </svg>
</template>
