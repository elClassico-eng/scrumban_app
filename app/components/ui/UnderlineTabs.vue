<script setup lang="ts" generic="T extends string">
import { Motion } from 'motion-v'
import { SIDEBAR_SPRING } from '~/utils/sidebar-items'

defineProps<{
  items: { value: T, label: string, icon: string, sub?: string }[]
  label: string
  indicatorId: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <nav class="-mx-1 flex overflow-x-auto border-b border-default px-1 sm:mx-0 sm:grid sm:auto-cols-fr sm:grid-flow-col sm:overflow-visible sm:px-0" :aria-label="label">
    <button
      v-for="t in items"
      :key="t.value"
      type="button"
      :class="[
        'relative flex shrink-0 cursor-pointer items-center gap-2.5 px-3 py-3 text-left transition-colors',
        model === t.value ? 'text-highlighted' : 'text-muted hover:text-default',
      ]"
      :aria-current="model === t.value ? 'page' : undefined"
      @click="model = t.value"
    >
      <UIcon :name="t.icon" class="size-5 shrink-0" />
      <span class="min-w-0">
        <span class="block text-sm font-semibold">{{ t.label }}</span>
        <span v-if="t.sub" class="block truncate text-xs text-dimmed">{{ t.sub }}</span>
      </span>
      <Motion
        v-if="model === t.value"
        :layout-id="indicatorId"
        class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent-500"
        :transition="SIDEBAR_SPRING"
      />
    </button>
  </nav>
</template>
