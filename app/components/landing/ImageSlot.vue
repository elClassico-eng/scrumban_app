<script setup lang="ts">
withDefaults(defineProps<{
  placeholder?: string
  shape?: 'rounded' | 'circle'
  radius?: number | string
}>(), {
  placeholder: '',
  shape: 'rounded',
  radius: 16,
})
</script>

<template>
  <div
    class="landing-slot"
    :class="`landing-slot--${shape}`"
    :style="shape === 'rounded' ? { borderRadius: `${radius}px` } : undefined"
  >
    <svg
      class="landing-slot__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
    <span v-if="placeholder" class="landing-slot__label">{{ placeholder }}</span>
  </div>
</template>