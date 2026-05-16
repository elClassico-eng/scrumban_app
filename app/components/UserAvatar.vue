<script setup lang="ts">
import type { DisplayNameSource } from '~/utils/display-name'

interface AvatarUser extends DisplayNameSource {
  avatarUrl?: string | null
}

const props = withDefaults(defineProps<{
  user: AvatarUser | null | undefined
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  tooltip?: boolean
  ring?: boolean
}>(), {
  size: 'md',
  tooltip: false,
  ring: false,
})

const SIZE_CLASS = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-base',
} as const

const label = computed(() => displayName(props.user))
const fallback = computed(() => initials(props.user))

const containerClass = computed(() => [
  'rounded-full bg-elevated text-default flex items-center justify-center font-medium shrink-0 overflow-hidden',
  SIZE_CLASS[props.size],
  props.ring ? 'ring-2 ring-white dark:ring-zinc-800' : '',
])
</script>

<template>
  <UTooltip v-if="tooltip && user" :text="label">
    <div :class="containerClass">
      <img
        v-if="user?.avatarUrl"
        :src="user.avatarUrl"
        :alt="label"
        class="size-full object-cover"
      >
      <span v-else>{{ fallback }}</span>
    </div>
  </UTooltip>
  <div v-else :class="containerClass">
    <img
      v-if="user?.avatarUrl"
      :src="user.avatarUrl"
      :alt="label"
      class="size-full object-cover"
    >
    <span v-else>{{ fallback }}</span>
  </div>
</template>
