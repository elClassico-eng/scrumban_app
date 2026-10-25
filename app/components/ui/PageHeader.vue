<script setup lang="ts">
import type { RouteTarget } from '~/utils/notification-render'

defineProps<{
  title: string
  subtitle?: string
  count?: number
  icon?: string
  back?: { to: RouteTarget; label: string }
}>()
</script>

<template>
  <header class="space-y-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <NuxtLink
          v-if="back"
          :to="back.to"
          class="inline-flex items-center gap-1 text-[12.5px] text-muted transition-colors hover:text-default mb-1"
        >
          <UIcon name="i-hugeicons-arrow-left-02" class="size-3.5" />
          {{ back.label }}
        </NuxtLink>
        <h1 class="m-0 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-default sm:text-[28px]">
          <UIcon v-if="icon" :name="icon" class="size-6 text-accent-500 shrink-0" />
          <span class="truncate">{{ title }}</span>
          <span v-if="count !== undefined" class="text-[18px] font-medium text-muted tabular-nums">· {{ count }}</span>
        </h1>
        <p v-if="subtitle || $slots.subtitle" class="m-0 mt-0.5 text-sm text-muted">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.below">
      <slot name="below" />
    </div>
  </header>
</template>
