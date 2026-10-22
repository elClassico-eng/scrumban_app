<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  logoUrl?: string | null
  size?: 'xs' | 'sm' | 'md'
}>(), { logoUrl: null, size: 'sm' })

const SIZE = {
  xs: 'size-5 rounded-md text-[10px]',
  sm: 'size-7 rounded-lg text-xs',
  md: 'size-9 rounded-xl text-sm',
} as const

const failed = ref(false)
watch(() => props.logoUrl, () => { failed.value = false })

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '·')
</script>

<template>
  <span :class="['grid shrink-0 place-items-center overflow-hidden font-bold text-white', SIZE[size], logoUrl && !failed ? 'bg-elevated' : 'brand-gradient']">
    <img
      v-if="logoUrl && !failed"
      :src="logoUrl"
      alt=""
      class="size-full object-cover"
      @error="failed = true"
    >
    <template v-else>{{ initial }}</template>
  </span>
</template>
