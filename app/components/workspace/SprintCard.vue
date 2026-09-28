<script setup lang="ts">
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  boardId?: string
}>()

const DAY_MS = 86_400_000

const { sprint, otherActive, isLoading } = useActiveSprint(() => props.wsId, () => props.boardId)

const { report } = useSprintNetworkApi(
  computed(() => props.wsId),
  computed(() => sprint.value?.boardId ?? ''),
  computed(() => sprint.value?.id ?? ''),
)

const forecast = computed(() => {
  const r = report.data.value
  return r && r.ok ? r : null
})
const insufficient = computed(() => report.data.value?.ok === false)

const days = computed(() => {
  const s = sprint.value
  const start = s?.startedAt ?? s?.plannedStartAt
  if (!s || !start || !s.plannedEndAt) return null
  const from = new Date(start).getTime()
  const to = new Date(s.plannedEndAt).getTime()
  const total = Math.max(1, Math.round((to - from) / DAY_MS))
  const passed = Math.round((Date.now() - from) / DAY_MS)
  return { total, current: Math.min(Math.max(passed, 0), total), left: total - passed }
})

const tasks = computed(() => {
  const f = forecast.value
  if (!f) return null
  const total = f.closedCount + f.remainingCount
  return { done: f.closedCount, total, pct: total ? Math.round((f.closedCount / total) * 100) : 0 }
})

const probability = computed(() => {
  const p = forecast.value?.simulation.probabilityWithinHorizon
  return p === null || p === undefined ? null : Math.round(p * 100)
})

const tone = computed(() => {
  const p = probability.value
  if (p === null) return { text: 'text-muted', bar: 'bg-zinc-400' }
  if (p >= 85) return { text: 'text-success-600', bar: 'bg-success-500' }
  if (p >= 50) return { text: 'text-accent-600', bar: 'bg-accent-500' }
  return { text: 'text-error-600', bar: 'bg-error-500' }
})

const DAYS = ['день', 'дня', 'дней'] as [string, string, string]
const dateFmt = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })

// The simulation measures the remaining work from today, while the sprint bar
// counts from its start. Showing both as days invites comparing 14.6 against
// the sprint length instead of against the time actually left, so the forecast
// is rendered as calendar dates next to the deadline.
function inDays(days: number): string {
  return dateFmt.format(new Date(Date.now() + days * DAY_MS))
}

const deadline = computed(() =>
  sprint.value?.plannedEndAt ? dateFmt.format(new Date(sprint.value.plannedEndAt)) : null,
)
</script>

<template>
  <section class="surface-soft flex min-w-0 flex-col rounded-2xl p-5">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h2 class="font-semibold text-default">Активный спринт</h2>
        <p v-if="sprint" class="truncate text-xs text-muted">
          {{ sprint.name }} · {{ sprint.boardName }}
          <template v-if="otherActive"> · ещё {{ otherActive }} активн.</template>
        </p>
      </div>
      <NuxtLink
        v-if="sprint"
        :to="pageRoutes.sprintSimulator(wsId, sprint.boardId, sprint.id)"
        class="shrink-0 text-xs text-muted transition-colors hover:text-accent-600"
      >
        Симулятор →
      </NuxtLink>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Загружаю спринты…</p>

    <div v-else-if="!sprint" class="flex flex-1 flex-col items-start justify-center gap-2">
      <p class="text-sm text-muted">
        {{ boardId ? 'На выбранной доске нет активного спринта.' : 'Активных спринтов нет.' }}
      </p>
      <NuxtLink
        v-if="boardId"
        :to="pageRoutes.boardSprints(wsId, boardId)"
        class="text-xs font-medium text-accent-600 hover:underline"
      >
        К спринтам доски
      </NuxtLink>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-3">
        <div v-if="days">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span class="text-muted">
              День <span class="font-medium tabular-nums text-default">{{ days.current }}</span>
              из <span class="font-medium tabular-nums text-default">{{ days.total }}</span>
            </span>
            <span :class="days.left < 0 ? 'text-error-600' : 'text-muted'">
              <template v-if="days.left < 0">просрочен на {{ -days.left }} {{ plural(-days.left, DAYS) }}</template>
              <template v-else>осталось {{ days.left }} {{ plural(days.left, DAYS) }}</template>
            </span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-zinc-400 dark:bg-zinc-500"
              :style="{ width: `${Math.min(100, (days.current / days.total) * 100)}%` }"
            />
          </div>
        </div>

        <div v-if="tasks">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span class="text-muted">
              Задачи <span class="font-medium tabular-nums text-default">{{ tasks.done }}</span>
              из <span class="font-medium tabular-nums text-default">{{ tasks.total }}</span>
            </span>
            <span class="tabular-nums text-muted">{{ tasks.pct }}%</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div class="h-full rounded-full bg-accent-500" :style="{ width: `${tasks.pct}%` }" />
          </div>
        </div>
      </div>

      <div class="flex shrink-0 flex-col justify-center gap-2 lg:w-52 lg:pl-5">
        <template v-if="probability !== null">
          <div class="flex items-baseline gap-2">
            <b :class="['text-3xl font-semibold leading-none tabular-nums', tone.text]">{{ probability }}%</b>
            <span class="text-xs text-muted">успеть в срок</span>
          </div>
          <p class="text-[11px] leading-snug text-muted">
            <template v-if="deadline">Срок <span class="font-medium text-default">{{ deadline }}</span> · </template>
            работа закончится
            P50 <span class="font-medium text-default">{{ inDays(forecast!.simulation.p50Days) }}</span>,
            P85 <span class="font-medium text-default">{{ inDays(forecast!.simulation.p85Days) }}</span>
          </p>
          <p class="text-[11px] text-muted">
            Монте-Карло, {{ forecast!.simulation.iterations.toLocaleString('ru-RU') }} прогонов
          </p>
        </template>

        <template v-else-if="insufficient">
          <p class="text-xs text-muted">
            Прогноза пока нет: слишком мало закрытых задач, чтобы оценить длительность.
          </p>
        </template>

        <template v-else-if="forecast">
          <p class="text-xs text-muted">У спринта не задана дата окончания, поэтому вероятность не считается.</p>
        </template>

        <p v-else class="text-xs text-muted">Считаю прогноз…</p>
      </div>
    </div>
  </section>
</template>
