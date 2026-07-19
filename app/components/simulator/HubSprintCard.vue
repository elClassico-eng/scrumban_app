<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  sprint: Sprint
  to: string
}>()

const dateRange = computed(() => {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : null
  const from = fmt(props.sprint.plannedStartAt)
  const to = fmt(props.sprint.plannedEndAt)
  if (from && to) return `${from} – ${to}`
  if (to) return `до ${to}`
  return 'даты не заданы'
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="group block bg-default border border-default rounded-xl px-4 py-3.5 space-y-2 transition-colors hover:border-accent-500"
    :class="sprint.state === 'active' ? 'ring-1 ring-accent-500/30' : ''"
  >
    <div class="flex items-center gap-2">
      <span class="text-[13.5px] font-semibold text-default truncate">{{ sprint.name }}</span>
      <div class="flex-1" />
      <SprintStateBadge :state="sprint.state" />
    </div>

    <p v-if="sprint.goal" class="text-[11.5px] text-muted m-0 line-clamp-1">{{ sprint.goal }}</p>

    <div class="flex items-center gap-2">
      <span class="text-[11px] text-muted tabular-nums inline-flex items-center gap-1">
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ dateRange }}
      </span>
      <div class="flex-1" />
      <span class="text-[11.5px] font-medium text-muted group-hover:text-accent-600 transition-colors inline-flex items-center gap-1">
        Открыть в симуляторе
        <UIcon name="i-lucide-arrow-right" class="size-3" />
      </span>
    </div>
  </NuxtLink>
</template>
