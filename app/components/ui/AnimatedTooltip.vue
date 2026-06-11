<script setup lang="ts">
import { Motion } from 'motion-v'

type AvatarItem = {
  id: string
  name: string
  designation?: string | null
  image?: string | null
  initials: string
  color: string
}

const props = withDefaults(defineProps<{ items: AvatarItem[]; size?: number; ring?: string }>(), {
  size: 32,
  ring: '#ffffff',
})

const hoveredId = ref<string | null>(null)
const mouseX = ref<number>(0)
const failedIds = ref(new Set<string>())

const rotation = computed(() => (mouseX.value / 100) * 40)
const translation = computed(() => (mouseX.value / 100) * 40)

function handleMouseEnter(event: MouseEvent, itemId: string) {
  hoveredId.value = itemId
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function handleMouseMove(event: MouseEvent) {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function onImgError(id: string) {
  failedIds.value = new Set(failedIds.value).add(id)
}

function showImage(item: AvatarItem): boolean {
  return !!item.image && !failedIds.value.has(item.id)
}
</script>

<template>
  <div class="flex items-center">
    <div
      v-for="item in props.items"
      :key="item.id"
      class="group relative -ml-2 first:ml-0"
      @mouseenter="(e) => handleMouseEnter(e, item.id)"
      @mouseleave="hoveredId = null"
      @mousemove="handleMouseMove"
    >
      <Motion
        v-if="hoveredId === item.id"
        :initial="{ opacity: 0, y: 20, scale: 0.6 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 260, damping: 10 }"
        :style="{ translateX: `${translation}px`, rotate: `${rotation}deg` }"
        class="absolute -top-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center rounded-lg bg-[#16161a] px-3 py-1.5 whitespace-nowrap shadow-xl ring-1 ring-white/10"
      >
        <div class="absolute -bottom-px left-1/2 h-px w-2/5 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#e85002] to-transparent" />
        <div class="text-[12px] font-semibold text-white">{{ item.name }}</div>
        <div v-if="item.designation" class="text-[10px] text-white/60">{{ item.designation }}</div>
      </Motion>

      <div
        class="overflow-hidden rounded-full flex items-center justify-center flex-shrink-0 transition group-hover:z-30 group-hover:scale-105"
        :style="{
          width: `${props.size}px`,
          height: `${props.size}px`,
          border: `2px solid ${props.ring}`,
          background: showImage(item) ? undefined : item.color,
        }"
      >
        <img
          v-if="showImage(item)"
          :src="item.image!"
          :alt="item.name"
          class="size-full object-cover"
          @error="onImgError(item.id)"
        >
        <span
          v-else
          class="font-bold text-white select-none"
          :style="{ fontSize: `${Math.round(props.size * 0.34)}px` }"
        >{{ item.initials }}</span>
      </div>
    </div>
  </div>
</template>
