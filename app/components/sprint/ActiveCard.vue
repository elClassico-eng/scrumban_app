<script setup lang="ts">
import type { Sprint, BurndownReport } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

interface SprintTaskWithMeta {
  task: Task
  addedAfterStart: boolean
}

const props = defineProps<{
  sprint: Sprint
  tasks: SprintTaskWithMeta[]
  columns: BoardColumn[]
  members: MemberView[]
  burndown: BurndownReport | null
  canManage: boolean
  simulatorTo?: string
}>()

defineEmits<{
  'add-task': []
  close: []
  edit: []
}>()

const columnById = computed(() => {
  const m = new Map<string, BoardColumn>()
  for (const c of props.columns) m.set(c.id, c)
  return m
})

function isDoneTask(task: Task): boolean {
  return columnById.value.get(task.columnId)?.columnRole === 'done'
}

function sumSp(filter: (t: Task) => boolean): number {
  return props.tasks.filter(t => filter(t.task)).reduce((acc, t) => acc + (t.task.storyPoints ?? 0), 0)
}
function countTasks(filter: (t: Task) => boolean): number {
  return props.tasks.filter(t => filter(t.task)).length
}

const totalSp = computed(() => sumSp(() => true))
const doneSp = computed(() => sumSp(isDoneTask))
const committedSpRaw = computed(() =>
  props.tasks.filter(t => !t.addedAfterStart).reduce((acc, t) => acc + (t.task.storyPoints ?? 0), 0),
)
const addedSpRaw = computed(() =>
  props.tasks.filter(t => t.addedAfterStart).reduce((acc, t) => acc + (t.task.storyPoints ?? 0), 0),
)

const totalCount = computed(() => props.tasks.length)
const doneCount = computed(() => countTasks(isDoneTask))
const committedCount = computed(() => props.tasks.filter(t => !t.addedAfterStart).length)
const addedCount = computed(() => props.tasks.filter(t => t.addedAfterStart).length)

const useSp = computed(() => totalSp.value > 0 || props.sprint.capacity != null)
const unitLabel = computed(() => useSp.value ? 'SP' : 'задач')
const totalLabel = computed(() => useSp.value ? 'Всего' : 'Задач')

const committedValue = computed(() => useSp.value ? committedSpRaw.value : committedCount.value)
const doneValue = computed(() => useSp.value ? doneSp.value : doneCount.value)
const addedValue = computed(() => useSp.value ? addedSpRaw.value : addedCount.value)
const totalValue = computed(() => useSp.value ? totalSp.value : totalCount.value)
const capacity = computed(() => {
  if (useSp.value) return props.sprint.capacity ?? committedSpRaw.value ?? 1
  return committedCount.value || 1
})

const totalDays = computed(() => props.burndown?.totalDays ?? 0)
const daysGone = computed(() => {
  if (!props.sprint.startedAt) return 0
  const start = new Date(props.sprint.startedAt).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
})
const daysLeft = computed(() => Math.max(0, totalDays.value - daysGone.value))

const progressPct = computed(() =>
  committedValue.value > 0 ? Math.round((doneValue.value / committedValue.value) * 100) : 0,
)

const burndownPoints = computed(() => props.burndown?.points ?? [])
const isOnTrack = computed(() => {
  const point = burndownPoints.value[daysGone.value]
  if (!point || point.actual == null) return true
  return point.actual <= point.ideal
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}

const sprintGoals = computed(() => {
  const goal = props.sprint.goal?.trim()
  if (!goal) return []
  return goal.split('\n').map(g => g.trim()).filter(Boolean)
})
</script>

<template>
  <UiPanel>
    <template #title>
      <div class="min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="m-0 text-[17px] font-semibold tracking-tight text-default truncate">{{ sprint.name }}</h2>
          <SprintStateBadge :state="sprint.state" />
        </div>
        <p v-if="sprintGoals.length > 0" class="m-0 mt-0.5 text-[12.5px] text-muted truncate" :title="sprint.goal ?? ''">
          {{ sprintGoals.join(' · ') }}
        </p>
      </div>
    </template>
    <template v-if="canManage" #actions>
      <UButton size="sm" icon="i-lucide-plus" @click="$emit('add-task')">
        Добавить задачу
      </UButton>
      <UButton v-if="simulatorTo" size="sm" variant="ghost" color="neutral" icon="i-lucide-flask-conical" :to="simulatorTo">
        Симулятор
      </UButton>
      <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-check-square" @click="$emit('close')">
        Завершить
      </UButton>
      <UDropdownMenu :items="[{ label: 'Редактировать', icon: 'i-lucide-pencil', onSelect: () => $emit('edit') }]">
        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-ellipsis" title="Ещё" />
      </UDropdownMenu>
    </template>

    <div class="space-y-5">
      <div class="space-y-2">
        <p class="m-0 text-[13px] text-muted">
          <template v-if="totalDays > 0">День <b class="text-default">{{ daysGone + 1 }}</b> из {{ totalDays }} · </template>
          закрыто <b class="text-default">{{ doneCount }}</b> из {{ totalCount }} задач
          <template v-if="useSp"> · <b class="text-default">{{ doneValue }}</b> из {{ capacity }} SP</template>
          <template v-if="addedValue > 0"> · <span class="text-accent-600 dark:text-accent-400">+{{ addedValue }} {{ unitLabel }} после старта</span></template>
        </p>
        <div class="relative h-2 rounded-full bg-elevated overflow-hidden flex">
          <div class="h-full bg-emerald-500 transition-all" :style="{ width: `${(doneValue / capacity) * 100}%` }" />
          <div class="h-full bg-accent-500/70 transition-all" :style="{ width: `${(addedValue / capacity) * 100}%` }" />
          <div
            v-if="useSp && sprint.capacity != null"
            class="absolute top-0 bottom-0 w-px bg-zinc-700 z-10"
            :style="{ left: `${(committedValue / capacity) * 100}%` }"
            title="Коммит спринта"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <UiStat label="Прогресс" :value="`${progressPct}%`" :sub="`${doneValue} из ${committedValue} ${unitLabel}`" />
        <UiStat label="Осталось" :value="`${daysLeft} дн`" :sub="`до ${formatDate(sprint.plannedEndAt ?? sprint.endedAt)}`" />
        <UiStat label="Скоуп креп" :value="`+${addedValue} ${unitLabel}`" :sub="`${addedCount} задач после старта`" :tone="addedValue > 0 ? 'accent' : 'default'" />
        <UiStat :label="totalLabel" :value="`${totalValue} ${unitLabel}`" :sub="`${totalCount} задач`" />
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-2">
            <h3 class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Задачи спринта</h3>
            <span class="text-[11px] font-medium text-default bg-elevated px-1.5 py-0.5 rounded-full tabular-nums">{{ tasks.length }}</span>
          </div>
          <div class="rounded-lg overflow-hidden bg-elevated/60 divide-y divide-default">
            <SprintTaskRow
              v-for="t in tasks"
              :key="t.task.id"
              :task="t.task"
              :column="columnById.get(t.task.columnId) ?? null"
              :members="members"
              :added-after-start="t.addedAfterStart"
            />
            <button
              v-if="canManage"
              type="button"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-elevated transition-colors text-[12.5px] text-muted cursor-pointer"
              @click="$emit('add-task')"
            >
              <UIcon name="i-lucide-plus" class="size-3.5" />
              Добавить задачу из бэклога…
            </button>
          </div>
        </div>

        <div class="min-w-0">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <h3 class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Burndown</h3>
              <div class="flex-1" />
              <span
                v-if="burndownPoints.length > 0"
                class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded"
                :class="isOnTrack ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'"
              >
                {{ isOnTrack ? 'По графику' : 'Отстаём' }}
              </span>
            </div>
            <template v-if="burndownPoints.length > 0">
              <SprintBurndown :points="burndownPoints" />
              <div class="flex items-center gap-3 mt-2 text-[11px] text-muted">
                <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-px bg-accent-500" />Факт</span>
                <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-px border-t border-dashed border-zinc-400" />Идеал</span>
              </div>
            </template>
            <p v-else class="m-0 text-[12px] text-muted">Появится после первого закрытия задачи</p>
          </div>
        </div>
      </div>

      <div v-if="$slots.forecast" class="border-t border-default pt-5">
        <slot name="forecast" />
      </div>
    </div>
  </UiPanel>
</template>
