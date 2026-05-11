<script setup lang="ts">
import type { SprintState } from '#shared/types/domain'

const props = defineProps<{ state: SprintState }>()

const config = computed(() => {
  const map: Record<SprintState, { label: string; color: 'neutral' | 'info' | 'success' | 'warning' }> = {
    planned: { label: 'Запланирован', color: 'neutral' },
    active: { label: 'Активен', color: 'success' },
    closed: { label: 'Закрыт', color: 'info' },
  }
  return map[props.state]
})
</script>

<template>
  <UBadge :color="config.color" variant="subtle" size="sm">
    {{ config.label }}
  </UBadge>
</template>