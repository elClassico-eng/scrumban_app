<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  tone?: 'default' | 'danger'
}>(), { tone: 'default' })
</script>

<template>
  <section
    class="rounded-2xl p-5"
    :class="tone === 'danger' ? 'bg-error/5' : 'surface-soft'"
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
