<script setup lang="ts">
import type { Role } from '#shared/types/domain'

const props = defineProps<{ role: Role }>()

const config = computed(() => {
  const map: Record<Role, { label: string; dot: string }> = {
    viewer: { label: 'Наблюдатель', dot: 'bg-slate-400' },
    member: { label: 'Участник', dot: 'bg-sky-500' },
    scrum_master: { label: 'Скрам-мастер', dot: 'bg-violet-500' },
    admin: { label: 'Администратор', dot: 'bg-amber-500' },
    owner: { label: 'Владелец', dot: 'bg-emerald-500' },
  }
  return map[props.role]
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium text-default whitespace-nowrap">
    <span :class="['size-1.5 rounded-full shrink-0', config.dot]" />
    {{ config.label }}
  </span>
</template>