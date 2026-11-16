<script setup lang="ts">
import type { SectionMeta } from '~/utils/settings-sections'

defineProps<{ meta: SectionMeta, tone?: 'default' | 'danger' }>()
</script>

<template>
  <header class="mb-4 flex items-start gap-3">
    <span
      class="grid size-10 shrink-0 place-items-center rounded-xl"
      :class="tone === 'danger' ? 'bg-error/10 text-error' : 'bg-accent-500/10 text-accent-600 dark:text-accent-400'"
    >
      <UIcon :name="meta.icon" class="size-5" />
    </span>
    <div class="min-w-0">
      <h2 class="text-lg font-semibold text-default">{{ meta.label }}</h2>
      <p class="text-sm text-muted">{{ meta.description }}</p>
    </div>
  </header>
</template>
