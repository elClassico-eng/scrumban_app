<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  sprints: Sprint[]
}>()

const counts = computed(() => ({
  active: props.sprints.filter(s => s.state === 'active').length,
  planned: props.sprints.filter(s => s.state === 'planned').length,
  closed: props.sprints.filter(s => s.state === 'closed').length,
}))

const activeSprint = computed(() => props.sprints.find(s => s.state === 'active') ?? null)

const activeProgress = computed(() => {
  const s = activeSprint.value
  if (!s?.startedAt || !s.plannedEndAt) return null
  const start = new Date(s.startedAt).getTime()
  const end = new Date(s.plannedEndAt).getTime()
  const total = Math.max(1, Math.round((end - start) / 86_400_000))
  const gone = Math.max(0, Math.round((Date.now() - start) / 86_400_000))
  const left = Math.max(0, Math.round((end - Date.now()) / 86_400_000))
  return { total, gone: Math.min(gone, total), left, pct: Math.min(100, Math.round((Math.min(gone, total) / total) * 100)) }
})

const nextDeadline = computed(() => {
  const upcoming = props.sprints
    .filter(s => s.state !== 'closed' && s.plannedEndAt)
    .map(s => ({ name: s.name, end: new Date(s.plannedEndAt!).getTime() }))
    .filter(s => s.end >= Date.now())
    .sort((a, b) => a.end - b.end)
  const n = upcoming[0]
  if (!n) return null
  const days = Math.ceil((n.end - Date.now()) / 86_400_000)
  return { name: n.name, days }
})
</script>

<template>
  <section class="space-y-2.5">
    <h3 class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted m-0">Сводка</h3>

    <div class="grid grid-cols-3 gap-1.5">
      <div class="rounded-lg bg-elevated/50 px-2.5 py-2 text-center">
        <div class="text-[19px] font-semibold tracking-tight text-accent-600 tabular-nums leading-none">{{ counts.active }}</div>
        <div class="text-[10px] text-muted mt-1">активный</div>
      </div>
      <div class="rounded-lg bg-elevated/50 px-2.5 py-2 text-center">
        <div class="text-[19px] font-semibold tracking-tight text-default tabular-nums leading-none">{{ counts.planned }}</div>
        <div class="text-[10px] text-muted mt-1">в плане</div>
      </div>
      <div class="rounded-lg bg-elevated/50 px-2.5 py-2 text-center">
        <div class="text-[19px] font-semibold tracking-tight text-muted tabular-nums leading-none">{{ counts.closed }}</div>
        <div class="text-[10px] text-muted mt-1">закрыто</div>
      </div>
    </div>

    <div v-if="activeProgress" class="space-y-1.5 pt-0.5">
      <div class="flex items-center justify-between text-[11.5px]">
        <span class="text-muted">День {{ activeProgress.gone }} из {{ activeProgress.total }}</span>
        <span class="font-medium text-default tabular-nums">{{ activeProgress.left }} дн осталось</span>
      </div>
      <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
        <div class="h-full rounded-full bg-accent-500 transition-all" :style="{ width: `${activeProgress.pct}%` }" />
      </div>
    </div>

    <div v-if="nextDeadline" class="flex items-center gap-2 text-[12px] text-muted pt-0.5">
      <UIcon name="i-lucide-calendar-clock" class="size-3.5 shrink-0" />
      <span class="truncate">«{{ nextDeadline.name }}» через {{ nextDeadline.days }} дн</span>
    </div>
  </section>
</template>
