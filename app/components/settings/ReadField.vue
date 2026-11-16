<script setup lang="ts">
withDefaults(defineProps<{ label: string, value?: string | null, empty?: string }>(), { value: null, empty: 'Не указано' })
</script>

<template>
  <div class="min-w-0">
    <dt class="text-xs text-muted">{{ label }}</dt>
    <dd class="mt-0.5 whitespace-pre-line break-words text-sm" :class="value ? 'text-default' : 'text-dimmed'">
      <slot>{{ value || empty }}</slot>
    </dd>
  </div>
</template>
