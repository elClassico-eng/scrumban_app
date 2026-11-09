<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  tone?: 'default' | 'danger'
}>(), { tone: 'default' })
</script>

<template>
  <section
    class="rounded-2xl border p-5"
    :class="tone === 'danger' ? 'border-error/40 bg-error/5' : 'border-zinc-200 bg-white dark:border-default dark:bg-elevated/40'"
  >
    <header v-if="title || $slots.actions" class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 v-if="title" class="font-semibold" :class="tone === 'danger' ? 'text-error' : 'text-default'">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
