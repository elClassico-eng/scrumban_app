<script setup lang="ts">
const { start, authenticated } = useAccessCta()

const startSeen = ref(true)
const passedStart = ref(false)
const visibleEnds = ref(new Set<Element>())
const visible = computed(() => !startSeen.value && passedStart.value && visibleEnds.value.size === 0)

let observers: IntersectionObserver[] = []

onMounted(() => {
  const startEl = document.querySelector('[data-cta-start]')
  if (startEl) {
    const io = new IntersectionObserver(([entry]) => {
      startSeen.value = entry!.isIntersecting
      passedStart.value = entry!.boundingClientRect.top < 0
    })
    io.observe(startEl)
    observers.push(io)
  }
  const ends = document.querySelectorAll('[data-cta-end]')
  if (ends.length) {
    const io = new IntersectionObserver((entries) => {
      const next = new Set(visibleEnds.value)
      for (const e of entries) {
        if (e.isIntersecting) next.add(e.target)
        else next.delete(e.target)
      }
      visibleEnds.value = next
    })
    ends.forEach(el => io.observe(el))
    observers.push(io)
  }
})

onBeforeUnmount(() => {
  observers.forEach(io => io.disconnect())
  observers = []
})
</script>

<template>
  <Transition name="lfloat">
    <button v-if="visible" type="button" class="btn btn--dark btn--lg lfloat" @click="start">
      <TaktMark animated class="lfloat__mark" aria-hidden="true" />
      {{ authenticated ? 'Открыть Такт' : 'Попробовать Такт' }}
    </button>
  </Transition>
</template>

<style scoped>
.lfloat {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 45;
  box-shadow: 0 14px 40px -12px rgba(0, 0, 0, 0.45);
}
.lfloat__mark { width: 20px; height: 20px; color: var(--orange); }
.lfloat-enter-active, .lfloat-leave-active { transition: opacity 0.3s var(--ease), transform 0.3s var(--ease); }
.lfloat-enter-from, .lfloat-leave-to { opacity: 0; transform: translateY(12px); }

@media (max-width: 640px) {
  .lfloat { left: 12px; right: 12px; bottom: 12px; border-radius: 16px; }
}
</style>
