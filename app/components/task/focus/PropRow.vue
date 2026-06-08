<script setup lang="ts">
defineProps<{
  icon?: string
  label: string
  alignStart?: boolean
}>()
</script>

<template>
  <div
    class="grid grid-cols-[110px_1fr] gap-2.5 px-1.5 py-1.5 rounded-md min-h-[32px] hover:bg-default transition-colors"
    :class="alignStart ? 'items-start' : 'items-center'"
  >
    <span class="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <UIcon v-if="icon" :name="icon" class="size-3.5 text-dimmed" />
      {{ label }}
    </span>
    <span class="flex items-center gap-1.5 text-[13px] text-default min-w-0">
      <slot />
    </span>
  </div>
</template>