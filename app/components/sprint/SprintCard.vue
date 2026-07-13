<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'
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
  canManage: boolean
  simulatorTo?: string
  reportTo?: string
}>()

const emit = defineEmits<{
  'add-task': []
  start: []
  close: []
  delete: []
  edit: []
}>()

const expanded = ref(false)

const columnById = computed(() => {
  const m = new Map<string, BoardColumn>()
  for (const c of props.columns) m.set(c.id, c)
  return m
})

function isDoneTask(task: Task): boolean {
  return columnById.value.get(task.columnId)?.columnRole === 'done'
}

const totalSp = computed(() =>
  props.tasks.reduce((acc, t) => acc + (t.task.storyPoints ?? 0), 0),
)
const doneSp = computed(() =>
  props.tasks
    .filter(t => isDoneTask(t.task))
    .reduce((acc, t) => acc + (t.task.storyPoints ?? 0), 0),
)
const doneCount = computed(() =>
  props.tasks.filter(t => isDoneTask(t.task)).length,
)
const completionRate = computed(() =>
  props.tasks.length > 0 ? Math.round((doneCount.value / props.tasks.length) * 100) : 0,
)
const useSp = computed(() => totalSp.value > 0 || props.sprint.capacity != null)
const planValue = computed(() => useSp.value ? totalSp.value : props.tasks.length)
const planUnit = computed(() => useSp.value ? 'SP' : 'задач')
const progressDone = computed(() => useSp.value ? doneSp.value : doneCount.value)
const progressTotal = computed(() => useSp.value ? totalSp.value : props.tasks.length)

const teamMembers = computed(() => {
  const ids = new Set<string>()
  for (const t of props.tasks) for (const id of t.task.assigneeIds) ids.add(id)
  return props.members.filter(m => ids.has(m.userId)).slice(0, 4)
})

const statusLabel = computed(() => {
  if (props.sprint.state === 'planned') return 'Запланирован'
  if (props.sprint.state === 'closed') return 'Закрыт'
  return 'Активный'
})

const statusClasses = computed(() => {
  if (props.sprint.state === 'planned') return 'bg-elevated text-default'
  if (props.sprint.state === 'closed') return 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
  return 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'
})

const statusDotClasses = computed(() => {
  if (props.sprint.state === 'planned') return 'bg-zinc-400'
  if (props.sprint.state === 'closed') return 'bg-emerald-500'
  return 'bg-accent-500'
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}

const dateRangeDays = computed(() => {
  if (!props.sprint.plannedStartAt || !props.sprint.plannedEndAt) return null
  const start = new Date(props.sprint.plannedStartAt).getTime()
  const end = new Date(props.sprint.plannedEndAt).getTime()
  return Math.max(1, Math.round((end - start) / 86_400_000))
})

const sprintDescription = computed(() => props.sprint.goal?.trim() || '')

function onCardExpandToggle() {
  expanded.value = !expanded.value
}

function onAddClick(e: Event) {
  e.stopPropagation()
  emit('add-task')
}
</script>

<template>
  <div class="bg-default border border-default rounded-2xl p-5 flex flex-col gap-3">
    <div class="flex items-start gap-3">
      <h3 class="flex-1 text-[16px] font-semibold tracking-tight text-default leading-snug">
        {{ sprint.name }}
      </h3>
      <span
        class="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.04em] shrink-0"
        :class="statusClasses"
      >
        <span class="size-1.5 rounded-full" :class="statusDotClasses" />
        {{ statusLabel }}
      </span>
    </div>

    <p v-if="sprintDescription" class="text-[13px] text-muted leading-relaxed -mt-1">
      {{ sprintDescription }}
    </p>

    <div class="flex flex-wrap items-center gap-3 text-[12px] text-muted">
      <span class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-calendar" class="size-3.5" />
        <b class="text-default">{{ formatDate(sprint.plannedStartAt) }}</b>
        →
        <b class="text-default">{{ formatDate(sprint.plannedEndAt) }}</b>
        <span v-if="dateRangeDays">· {{ dateRangeDays }}д</span>
      </span>
      <span
        v-if="sprint.state === 'closed' && useSp && doneSp > 0"
        class="inline-flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-zap" class="size-3.5" />
        velocity <b class="text-default">{{ doneSp }} SP</b>
      </span>
      <span
        v-else-if="sprint.state === 'closed' && doneCount > 0"
        class="inline-flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-zap" class="size-3.5" />
        закрыто <b class="text-default">{{ doneCount }}</b> задач
      </span>
      <span v-if="sprint.endedAt && sprint.state === 'closed'" class="inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-check" class="size-3.5" />
        закрыт {{ formatDate(sprint.endedAt) }}
      </span>
    </div>

    <SprintForecastVsFact v-if="sprint.state === 'closed'" :sprint="sprint" />

    <div v-if="tasks.length > 0" class="grid grid-cols-3 gap-2">
      <div class="bg-muted rounded-lg px-3 py-2">
        <div class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Задач</div>
        <div class="text-[18px] font-semibold tracking-tight text-default">{{ tasks.length }}</div>
      </div>
      <div class="bg-muted rounded-lg px-3 py-2">
        <div class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">
          {{ sprint.state === 'closed' ? 'Завершено' : 'План' }}
        </div>
        <div class="text-[18px] font-semibold tracking-tight text-default">
          <template v-if="sprint.state === 'closed'">
            {{ completionRate }}<span class="text-[12px] text-muted font-normal ml-0.5">%</span>
          </template>
          <template v-else>
            {{ planValue }}<span class="text-[12px] text-muted font-normal ml-0.5">{{ planUnit }}</span>
          </template>
        </div>
      </div>
      <div class="bg-muted rounded-lg px-3 py-2">
        <div class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Команда</div>
        <div class="flex items-center -space-x-1.5 h-[22px] mt-1">
          <UserAvatar
            v-for="m in teamMembers"
            :key="m.userId"
            :user="m"
            size="xs"
            ring
            tooltip
          />
          <span
            v-if="teamMembers.length === 0"
            class="text-[12px] text-muted"
          >—</span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex items-center gap-2 px-3 py-3 rounded-lg bg-muted border border-dashed border-default text-[12.5px] text-muted"
    >
      <UIcon name="i-lucide-plus" class="size-3.5" />
      <span class="flex-1">В спринте пока нет задач</span>
      <button
        v-if="canManage"
        type="button"
        class="inline-flex items-center gap-1 text-[12px] text-accent-600 font-medium hover:text-accent-700 cursor-pointer"
        @click="emit('add-task')"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Добавить
      </button>
    </div>

    <button
      v-if="tasks.length > 0"
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-elevated transition-colors text-[12.5px] text-default cursor-pointer"
      @click="onCardExpandToggle"
    >
      <UIcon
        name="i-lucide-chevron-right"
        class="size-3.5 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
      />
      <span class="font-medium">Задачи</span>
      <span class="text-muted">
        {{ sprint.state === 'closed' ? `${doneCount}/${tasks.length} закрыто` : `${progressDone}/${progressTotal} ${planUnit}` }}
      </span>
      <span
        v-if="sprint.state !== 'closed' && progressTotal > 0"
        class="ml-auto h-1 w-16 bg-accented rounded-full overflow-hidden"
      >
        <span
          class="block h-full bg-accent-500 transition-all"
          :style="{ width: `${(progressDone / progressTotal) * 100}%` }"
        />
      </span>
      <span
        v-if="canManage && sprint.state !== 'closed'"
        class="inline-flex items-center gap-1 text-[11.5px] text-accent-600 font-medium hover:text-accent-700 cursor-pointer"
        @click="onAddClick"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Добавить
      </span>
    </button>

    <div
      v-if="expanded && tasks.length > 0"
      class="border border-default rounded-lg overflow-hidden bg-default"
    >
      <SprintTaskRow
        v-for="t in tasks.slice(0, 6)"
        :key="t.task.id"
        :task="t.task"
        :column="columnById.get(t.task.columnId) ?? null"
        :members="members"
        :added-after-start="t.addedAfterStart"
      />
      <div
        v-if="tasks.length > 6"
        class="px-3 py-2 text-center text-[11.5px] text-muted border-t border-default"
      >
        + ещё {{ tasks.length - 6 }} задач(и)
      </div>
    </div>

    <div class="flex items-center gap-1.5 pt-1">
      <template v-if="sprint.state === 'planned' && canManage">
        <UButton size="xs" icon="i-lucide-play" @click="emit('start')">Запустить</UButton>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-pencil"
          @click="emit('edit')"
        >Редактировать</UButton>
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-trash-2"
          @click="emit('delete')"
        >Удалить</UButton>
      </template>
      <UButton
        v-if="simulatorTo && sprint.state !== 'closed'"
        size="xs"
        variant="outline"
        color="neutral"
        icon="i-lucide-flask-conical"
        :to="simulatorTo"
      >Симулятор</UButton>
      <template v-else-if="sprint.state === 'closed'">
        <UButton
          v-if="reportTo"
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-file-bar-chart-2"
          :to="reportTo"
        >
          Отчёт
        </UButton>
        <UButton
          v-if="reportTo"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-messages-square"
          :to="`${reportTo}?tab=retro`"
        >Ретроспектива</UButton>
      </template>
    </div>
  </div>
</template>
