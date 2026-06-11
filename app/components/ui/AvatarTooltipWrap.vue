<script setup lang="ts">
import { Motion } from 'motion-v'

defineProps<{ name: string; designation?: string | null }>()

const hovered = ref(false)
const mouseX = ref(0)
const anchor = ref<{ cx: number; top: number } | null>(null)
const rotation = computed(() => (mouseX.value / 100) * 40)
const translation = computed(() => (mouseX.value / 100) * 40)

function track(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = e.clientX - rect.left - rect.width / 2
  anchor.value = { cx: rect.left + rect.width / 2, top: rect.top }
}

function onEnter(e: MouseEvent) {
  hovered.value = true
  track(e)
}
</script>

<template>
  <div class="relative inline-flex" @mouseenter="onEnter" @mouseleave="hovered = false" @mousemove="track">
    <Teleport to="body">
      <div
        v-if="hovered && anchor"
        class="fixed z-[200] -translate-x-1/2 pointer-events-none"
        :style="{ left: `${anchor.cx}px`, top: `${anchor.top - 48}px` }"
      >
        <Motion
          :initial="{ opacity: 0, y: 14, scale: 0.6 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :transition="{ type: 'spring', stiffness: 260, damping: 12 }"
          :style="{ translateX: `${translation}px`, rotate: `${rotation}deg` }"
          class="relative flex flex-col items-center rounded-lg bg-[#16161a] px-3 py-1.5 shadow-xl ring-1 ring-white/10 whitespace-nowrap"
        >
          <div class="absolute -bottom-px left-1/2 -translate-x-1/2 h-px w-2/3 bg-gradient-to-r from-transparent via-[#e85002] to-transparent" />
          <div class="text-[12px] font-semibold text-white">{{ name }}</div>
          <div v-if="designation" class="text-[10px] text-white/60">{{ designation }}</div>
        </Motion>
      </div>
    </Teleport>
    <slot />
  </div>
</template>
