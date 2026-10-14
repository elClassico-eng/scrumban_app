<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  text?: string
  compact?: boolean
}>()
</script>

<template>
  <div class="flex flex-col items-center text-center" :class="compact ? 'py-8 gap-1.5' : 'py-16 gap-2'">
    <UIcon :name="icon" class="text-muted" :class="compact ? 'size-6' : 'size-10'" />
    <p class="m-0 font-medium text-default" :class="compact ? 'text-[13px]' : 'text-[15px]'">{{ title }}</p>
    <p v-if="text" class="m-0 text-muted max-w-md" :class="compact ? 'text-[12px]' : 'text-[13px]'">{{ text }}</p>
    <div v-if="$slots.actions" class="flex items-center gap-2 pt-2">
      <slot name="actions" />
    </div>
  </div>
</template>
