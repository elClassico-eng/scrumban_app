<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'accent' | 'success' | 'warning'
}>(), { sub: undefined, tone: 'default' })

const TONE = {
  default: 'text-default',
  accent: 'text-accent-500',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
} as const
</script>

<template>
  <div class="min-w-0">
    <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{{ label }}</p>
    <p class="m-0 mt-1 text-[22px] font-semibold tabular-nums leading-none" :class="TONE[tone]">{{ value }}</p>
    <p v-if="sub" class="m-0 mt-1 text-[12px] text-muted">{{ sub }}</p>
  </div>
</template>
