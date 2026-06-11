<script setup lang="ts">
type PeekEvent = {
  iconType: 'move' | 'at' | 'build' | 'check'
  color: string
  title: string
  sub: string
  act: string
}

defineProps<{
  peek: PeekEvent | null
}>()

const ICON_MAP: Record<string, string> = {
  move: 'i-lucide-move',
  at: 'i-lucide-at-sign',
  build: 'i-lucide-hammer',
  check: 'i-lucide-check',
}

function resolveIcon(iconType: string): string {
  return ICON_MAP[iconType] ?? 'i-lucide-circle'
}
</script>

<template>
  <template v-if="peek">
    <span
      class="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-shrink-0 text-white"
      :style="{ background: peek.color }"
    >
      <UIcon :name="resolveIcon(peek.iconType)" class="w-[14px] h-[14px]" />
    </span>
    <div class="min-w-0">
      <b class="block text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-[var(--island-ink)]">{{ peek.title }}</b>
      <span class="text-[11px] text-[var(--island-ink-3)]">{{ peek.sub }}</span>
    </div>
    <div class="flex-1" />
    <span v-if="peek.act" class="text-[11.5px] font-semibold text-[var(--island-orange-2)] whitespace-nowrap">{{ peek.act }}</span>
  </template>
</template>
