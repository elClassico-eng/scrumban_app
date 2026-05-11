<script setup lang="ts">
import type { Role } from '#shared/types/domain'

const props = defineProps<{ role: Role }>()

const config = computed(() => {
  const map: Record<Role, { label: string; color: 'neutral' | 'info' | 'success' | 'warning' | 'primary' }> = {
    viewer: { label: 'Наблюдатель', color: 'neutral' },
    member: { label: 'Участник', color: 'info' },
    scrum_master: { label: 'Скрам-мастер', color: 'primary' },
    admin: { label: 'Администратор', color: 'warning' },
    owner: { label: 'Владелец', color: 'success' },
  }
  return map[props.role]
})
</script>

<template>
  <UBadge :color="config.color" variant="subtle" size="sm">
    {{ config.label }}
  </UBadge>
</template>