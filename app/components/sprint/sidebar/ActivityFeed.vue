<script setup lang="ts">
import type { SprintActivityItem, SprintActivityKind } from '#shared/types/sprint-activity'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const { activity } = useSprintActivityApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const items = computed(() => activity.data.value ?? [])

const META: Record<SprintActivityKind, { icon: string; tone: string; verb: (i: SprintActivityItem) => string }> = {
  sprint_started: { icon: 'i-lucide-play', tone: 'text-emerald-600 dark:text-emerald-400', verb: i => `Спринт «${i.sprintName}» запущен` },
  sprint_closed: { icon: 'i-lucide-flag', tone: 'text-muted', verb: i => `Спринт «${i.sprintName}» закрыт` },
  dates_changed: { icon: 'i-lucide-calendar-clock', tone: 'text-accent-600', verb: i => `Даты «${i.sprintName}» сдвинуты${i.reason ? `: ${i.reason}` : ''}` },
  capacity_changed: { icon: 'i-lucide-gauge', tone: 'text-muted', verb: i => `Вместимость «${i.sprintName}» изменена` },
  task_added: { icon: 'i-lucide-circle-plus', tone: 'text-emerald-600 dark:text-emerald-400', verb: i => `«${i.taskTitle}» добавлена в «${i.sprintName}»` },
  task_removed: { icon: 'i-lucide-circle-minus', tone: 'text-muted', verb: i => `«${i.taskTitle}» убрана из спринта` },
  task_blocked: { icon: 'i-lucide-octagon-x', tone: 'text-red-500', verb: i => `«${i.taskTitle}» заблокирована${i.reason ? `: ${i.reason}` : ''}` },
  task_unblocked: { icon: 'i-lucide-octagon', tone: 'text-emerald-600 dark:text-emerald-400', verb: i => `«${i.taskTitle}» разблокирована` },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч`
  const d = Math.floor(h / 24)
  return `${d} дн`
}

function itemLink(i: SprintActivityItem) {
  if (i.taskId) return pageRoutes.task(props.workspaceId, props.boardId, i.taskId)
  return undefined
}
</script>

<template>
  <section class="space-y-2.5">
    <h3 class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted m-0 flex items-center gap-1.5">
      <span class="relative inline-flex">
        <span class="size-1.5 rounded-full bg-emerald-500" />
        <span class="absolute inset-0 rounded-full ring-2 ring-emerald-500/40 animate-ping" />
      </span>
      Активность
    </h3>

    <div v-if="items.length === 0" class="text-[12px] text-dimmed py-2">
      Пока тихо. События спринтов появятся здесь.
    </div>

    <TransitionGroup
      v-else
      tag="ul"
      name="feed"
      class="space-y-0.5 m-0 p-0 list-none"
    >
      <li v-for="i in items" :key="i.id">
        <component
          :is="itemLink(i) ? 'NuxtLink' : 'div'"
          :to="itemLink(i)"
          class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
          :class="itemLink(i) ? 'hover:bg-elevated/60 cursor-pointer' : ''"
        >
          <UIcon :name="META[i.kind].icon" class="size-3.5 shrink-0 mt-0.5" :class="META[i.kind].tone" />
          <span class="flex-1 min-w-0 text-[12.5px] leading-snug text-default">{{ META[i.kind].verb(i) }}</span>
          <span class="shrink-0 text-[10.5px] text-dimmed tabular-nums mt-0.5">{{ relTime(i.atISO) }}</span>
        </component>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.feed-enter-active {
  transition: opacity 400ms ease, transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
.feed-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.feed-enter-to {
  background-color: color-mix(in srgb, var(--color-accent-500) 8%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .feed-enter-active {
    transition: opacity 200ms ease;
  }
  .feed-enter-from { transform: none; }
}
</style>
