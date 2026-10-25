<script setup lang="ts">
import { isIconName } from '#shared/constants/board-icons'
import type { Board } from '#shared/types/board'

const props = withDefaults(defineProps<{
  board: Pick<Board, 'name' | 'color' | 'icon'> | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
}>(), { size: 'xs' })

const SIZE = {
  xs: { box: 'size-5 rounded-md text-[10px]', icon: 'size-3', emoji: 'text-[11px]' },
  sm: { box: 'size-6 rounded-md text-xs', icon: 'size-3.5', emoji: 'text-[13px]' },
  md: { box: 'size-9 rounded-xl text-sm', icon: 'size-5', emoji: 'text-lg' },
  lg: { box: 'size-12 rounded-2xl text-lg', icon: 'size-6', emoji: 'text-2xl' },
} as const

const icon = computed(() => props.board?.icon ?? null)
const isEmoji = computed(() => !!icon.value && !isIconName(icon.value))
const background = computed(() => {
  const color = props.board?.color ?? '#94a3b8'
  return isEmoji.value ? `${color}33` : color
})
const letter = computed(() => props.board?.name.trim().charAt(0).toUpperCase() || '·')
</script>

<template>
  <span
    :class="['grid shrink-0 place-items-center font-bold leading-none text-white', SIZE[size].box]"
    :style="{ background }"
    :title="board?.name"
  >
    <span v-if="isEmoji" :class="SIZE[size].emoji">{{ icon }}</span>
    <UIcon v-else-if="icon" :name="icon" :class="SIZE[size].icon" />
    <template v-else>{{ letter }}</template>
  </span>
</template>
