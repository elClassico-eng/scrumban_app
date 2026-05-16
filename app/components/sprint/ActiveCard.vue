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
}>()

defineEmits<{
  'add-task': []
  close: []
}>()

const columnById = computed(() => {
  const m = new Map<string, BoardColumn>()
  for (const c of props.columns) m.set(c.id, c)
  return m
})

function isDoneTask(task: Task): boolean {
  return columnById.value.get(task.columnId)?.columnRole === 'done'
}

function isProgressTask(task: Task): boolean {
  const role = columnById.value.get(task.columnId)?.columnRole
  return role === 'in_progress' || role === 'review'
}

function isTodoTask(task: Task): boolean {
  const role = columnById.value.get(task.columnId)?.columnRole
  return role === 'backlog'
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

const distribution = computed(() => {
  const accumulate = (filter: (task: Task) => boolean) =>
    useSp.value ? sumSp(filter) : countTasks(filter)
  return [
    { key: 'done', label: 'Готово', value: accumulate(isDoneTask), color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'progress', label: 'В работе', value: accumulate(isProgressTask), color: 'bg-accent-500', dot: 'bg-accent-500' },
    { key: 'todo', label: 'К выполнению', value: accumulate(isTodoTask), color: 'bg-zinc-400', dot: 'bg-zinc-400' },
  ]
})
const distributionTotal = computed(() => distribution.value.reduce((a, s) => a + s.value, 0))

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
  <div class="bg-white border border-default rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
    <div class="px-6 py-6 lg:border-r border-default flex flex-col gap-4 min-w-0">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-600">
            <span class="size-2 rounded-full bg-accent-500" />
            Активный спринт
            <span v-if="totalDays > 0" class="text-muted">· день {{ daysGone + 1 }} из {{ totalDays }}</span>
          </span>
          <h2 class="text-[22px] font-semibold tracking-tight text-default mt-1.5 break-words">
            {{ sprint.name }}
          </h2>
        </div>
        <UDropdownMenu
          v-if="canManage"
          :items="[
            { label: 'Завершить спринт', icon: 'i-lucide-check-square', onSelect: () => $emit('close') },
          ]"
        >
          <button
            type="button"
            class="size-7 rounded-md grid place-items-center text-muted hover:bg-zinc-100 hover:text-default transition-colors cursor-pointer"
            title="Действия"
          >
            <UIcon name="i-lucide-more-horizontal" class="size-4" />
          </button>
        </UDropdownMenu>
      </div>

      <p v-if="sprint.goal && sprintGoals.length === 1" class="text-[13.5px] text-muted leading-relaxed -mt-1">
        {{ sprint.goal }}
      </p>

      <div class="space-y-2">
        <div class="relative h-2 rounded-full bg-zinc-100 overflow-hidden flex">
          <div
            class="h-full bg-emerald-500 transition-all"
            :style="{ width: `${(doneValue / capacity) * 100}%` }"
          />
          <div
            class="h-full bg-brand-500 transition-all"
            :style="{ width: `${Math.max(0, (committedValue - doneValue) / capacity) * 100}%` }"
          />
          <div
            class="h-full bg-accent-500 transition-all"
            :style="{ width: `${(addedValue / capacity) * 100}%` }"
          />
          <div
            v-if="useSp && sprint.capacity != null"
            class="absolute top-0 bottom-0 w-px bg-zinc-700 z-10"
            :style="{ left: `${(committedValue / capacity) * 100}%` }"
            title="Коммит спринта"
          />
        </div>
        <div class="flex items-center gap-3 flex-wrap text-[11.5px] text-muted">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-emerald-500" />
            <b class="text-default">{{ doneValue }}</b> готово
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-brand-500" />
            <b class="text-default">{{ Math.max(0, committedValue - doneValue) }}</b> в работе
          </span>
          <span v-if="addedValue > 0" class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-accent-500" />
            <b class="text-default">{{ addedValue }}</b> добавлено после старта
          </span>
          <span v-if="useSp" class="ml-auto">из <b class="text-default">{{ capacity }}</b> SP capacity</span>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="bg-zinc-50 rounded-lg px-3 py-2.5">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Прогресс</div>
          <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
            {{ progressPct }}<span class="text-[12px] text-muted font-normal ml-0.5">%</span>
          </div>
          <div class="text-[11px] text-muted mt-0.5">{{ doneValue }} из {{ committedValue }} {{ unitLabel }}</div>
        </div>
        <div class="bg-zinc-50 rounded-lg px-3 py-2.5">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Осталось</div>
          <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
            {{ daysLeft }}<span class="text-[12px] text-muted font-normal ml-0.5">дн</span>
          </div>
          <div class="text-[11px] text-muted mt-0.5">{{ formatDate(sprint.plannedEndAt ?? sprint.endedAt) }}</div>
        </div>
        <div
          class="rounded-lg px-3 py-2.5"
          :class="addedValue > 0 ? 'bg-accent-50' : 'bg-zinc-50'"
        >
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Скоуп креп</div>
          <div
            class="text-[22px] font-semibold tracking-tight mt-0.5"
            :class="addedValue > 0 ? 'text-accent-700' : 'text-default'"
          >
            +{{ addedValue }}<span class="text-[12px] text-muted font-normal ml-0.5">{{ unitLabel }}</span>
          </div>
          <div class="text-[11px] text-muted mt-0.5">
            {{ addedCount }} задач после старта
          </div>
        </div>
        <div class="bg-zinc-50 rounded-lg px-3 py-2.5">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">{{ totalLabel }}</div>
          <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
            {{ totalValue }}<span class="text-[12px] text-muted font-normal ml-0.5">{{ unitLabel }}</span>
          </div>
          <div class="text-[11px] text-muted mt-0.5">{{ totalCount }} задач</div>
        </div>
      </div>

      <div v-if="sprintGoals.length > 0" class="space-y-1.5">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          Цели спринта
        </div>
        <div
          v-for="(goal, idx) in sprintGoals"
          :key="idx"
          class="flex items-start gap-2 text-[13px] text-default"
        >
          <span class="size-3.5 rounded-full border-[1.5px] border-zinc-300 shrink-0 mt-0.5" />
          <span>{{ goal }}</span>
        </div>
      </div>
    </div>

    <div class="px-6 py-6 flex flex-col gap-4 min-w-0 bg-zinc-50/40">
      <div class="bg-white border border-default rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
            Burndown
          </h4>
          <div class="flex-1" />
          <span
            class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded"
            :class="isOnTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-50 text-accent-700'"
          >
            {{ isOnTrack ? 'По графику' : 'Отстаём' }}
          </span>
        </div>
        <SprintBurndown v-if="burndown && burndown.points.length > 0" :points="burndown.points" />
        <div
          v-else
          class="h-[110px] flex items-center justify-center text-[11.5px] text-muted text-center px-3"
        >
          Burndown появится после первого закрытия задачи
        </div>
        <div class="flex items-center gap-3 mt-2 text-[11px] text-muted">
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2.5 h-px bg-accent-500" />
            Факт
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2.5 h-px border-t border-dashed border-zinc-400" />
            Идеал
          </span>
        </div>
      </div>

      <div>
        <div class="flex items-center gap-2 mb-2">
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
            Распределение по доске
          </h4>
          <div class="flex-1" />
          <span class="text-[11px] font-medium text-default bg-zinc-100 px-1.5 py-0.5 rounded-full">
            {{ totalValue }} {{ unitLabel }}
          </span>
        </div>
        <div v-if="distributionTotal > 0" class="h-2 rounded-full overflow-hidden flex bg-zinc-100">
          <div
            v-for="seg in distribution"
            :key="seg.key"
            :class="seg.color"
            class="h-full"
            :style="{ width: `${(seg.value / distributionTotal) * 100}%` }"
            :title="`${seg.label}: ${seg.value} ${unitLabel}`"
          />
        </div>
        <div v-else class="h-2 rounded-full bg-zinc-100" />
        <div class="grid grid-cols-3 gap-2 mt-2">
          <div v-for="seg in distribution" :key="seg.key" class="text-[11px]">
            <div class="inline-flex items-center gap-1 text-muted">
              <span class="size-1.5 rounded-full" :class="seg.dot" />
              {{ seg.label }}
            </div>
            <div class="text-default font-semibold">
              {{ seg.value }}<span class="text-[10.5px] text-muted font-normal ml-0.5">{{ unitLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="canManage" class="flex flex-col gap-2 mt-auto">
        <UButton block size="sm" icon="i-lucide-plus" @click="$emit('add-task')">
          Добавить задачу
        </UButton>
        <UButton block size="sm" variant="outline" color="neutral" icon="i-lucide-check-square" @click="$emit('close')">
          Завершить спринт
        </UButton>
      </div>
    </div>

    <div class="lg:col-span-2 px-6 pb-6">
      <div class="flex items-center gap-2 mb-2.5">
        <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
          Задачи спринта
        </h4>
        <span class="text-[11px] font-medium text-default bg-zinc-100 px-1.5 py-0.5 rounded-full">
          {{ tasks.length }}
        </span>
        <div class="flex-1" />
      </div>

      <div class="border border-default rounded-lg overflow-hidden bg-white">
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
          class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-zinc-50/50 hover:bg-zinc-100/60 transition-colors text-[12.5px] text-muted cursor-pointer border-t border-zinc-100"
          @click="$emit('add-task')"
        >
          <span class="size-5 rounded-full grid place-items-center bg-white border border-dashed border-zinc-300 text-zinc-400">
            <UIcon name="i-lucide-plus" class="size-3" />
          </span>
          <span class="flex-1">Добавить задачу из бэклога…</span>
        </button>
      </div>
    </div>
  </div>
</template>
