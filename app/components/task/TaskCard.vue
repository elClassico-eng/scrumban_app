<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{ task: Task; workspaceId: string }>()

const router = useRouter()
const route = useRoute()
function openTask() {
  router.push({
    path: route.path,
    query: { ...route.query, task: props.task.id },
  })
}

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.task.boardId)
const { list: membersList } = useMembersApi(wsId)
const { list: boardsList } = useBoardsApi(wsId)
const { list: tasksList } = useTasksApi(wsId, bId)
const { byTaskId: depCountsByTaskId } = useBoardDependencyCountsApi(wsId, bId)

const blockerCount = computed(() => depCountsByTaskId.value.get(props.task.id)?.blockerCount ?? 0)

const { memberships: taskSprints } = useTaskSprintMembership(wsId, bId, computed(() => props.task.id))
const sprintChip = computed(() => taskSprints.value.find(s => s.state === 'active') ?? taskSprints.value[0] ?? null)

const memberById = computed(() => {
  const m = new Map<string, NonNullable<typeof membersList.data.value>['members'][number]>()
  for (const member of membersList.data.value?.members ?? []) m.set(member.userId, member)
  return m
})

const assigneeIds = computed(() => props.task.assigneeIds ?? [])
const visibleAssignees = computed(() =>
  assigneeIds.value
    .slice(0, 3)
    .map(id => memberById.value.get(id))
    .filter((x): x is NonNullable<typeof x> => !!x),
)
const hiddenAssigneesCount = computed(() =>
  Math.max(0, assigneeIds.value.length - visibleAssignees.value.length),
)

const parentTask = computed(() => {
  if (!props.task.parentTaskId) return null
  return tasksList.data.value?.tasks.find(t => t.id === props.task.parentTaskId) ?? null
})

const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === props.task.boardId) ?? null,
)
const agingTier = computed(() =>
  getAgingTier(ageDaysFromIso(props.task.createdAt), board.value?.sleDays ?? null),
)
const agingTooltip = computed(() => {
  if (agingTier.value.level === 'fresh') return undefined
  const days = ageDaysFromIso(props.task.createdAt).toFixed(1)
  const sle = board.value?.sleDays
  const pct = board.value?.sleProbability != null ? Math.round(Number(board.value.sleProbability) * 100) : null
  if (sle == null || pct == null) return `Возраст ${days} дн`
  return `Возраст ${days} дн · SLE доски: ${pct}% задач ≤ ${sle} дн — эта висит дольше типичного`
})

interface DueState {
  label: string
  tone: 'overdue' | 'today' | 'soon' | 'normal'
}
const dueState = computed<DueState | null>(() => {
  const info = dueInfo(props.task.dueDate)
  if (!info) return null
  if (info.tone === 'overdue') return { label: `просрочена на ${-info.diff}д`, tone: 'overdue' }
  if (info.tone === 'today') return { label: 'сегодня', tone: 'today' }
  if (info.diff === 1) return { label: 'завтра', tone: 'soon' }
  if (info.tone === 'soon') return { label: `${info.dateLabel} · через ${info.diff}д`, tone: 'soon' }
  return { label: info.dateLabel, tone: 'normal' }
})

const stripeColor = computed(() => {
  if (props.task.blockedReason || blockerCount.value > 0) return 'bg-red-500'
  if (props.task.serviceClass === 'expedite') return 'bg-accent-500'
  if (props.task.serviceClass === 'fixed_date') return 'bg-amber-500'
  if (props.task.serviceClass === 'intangible') return 'bg-zinc-300'
  return 'bg-zinc-400'
})

const shortId = computed(() => props.task.id.slice(0, 6).toUpperCase())
const isDone = computed(() => props.task.closedAt != null)
</script>

<template>
  <div
    class="group relative bg-default border border-default rounded-lg pl-4 pr-3 py-2.5 cursor-pointer hover:border-zinc-400 hover:shadow-sm transition-all overflow-hidden"
    :class="[
      isDone ? 'bg-muted' : '',
      task.blockedReason || blockerCount > 0 ? 'border-red-200' : '',
    ]"
    @click="openTask"
  >
    <span :class="['absolute left-0 top-0 bottom-0 w-[3px]', stripeColor]" />

    <div class="flex items-center gap-1.5 min-w-0 mb-1.5">
      <span class="font-mono text-[11px] text-muted shrink-0">{{ shortId }}</span>
      <span
        v-if="parentTask"
        class="inline-flex items-center gap-1 px-1.5 h-[18px] rounded bg-elevated font-mono text-[10.5px] text-muted truncate min-w-0"
        :title="parentTask.title"
      >
        <UIcon
          v-if="parentTask.isEpic"
          name="i-lucide-crown"
          class="size-3 text-accent-500 shrink-0"
        />
        <UIcon
          v-else
          name="i-lucide-corner-left-up"
          class="size-3 shrink-0"
        />
        <span class="truncate">{{ parentTask.id.slice(0, 6).toUpperCase() }}</span>
      </span>
      <div class="flex-1" />
      <span
        v-if="task.serviceClass === 'expedite'"
        class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300 text-[10px] font-bold uppercase tracking-[0.04em] shrink-0"
      >
        <UIcon name="i-lucide-zap" class="size-3" />
        Срочная
      </span>
      <span
        v-if="task.serviceClass === 'fixed_date'"
        class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-[0.04em] shrink-0"
      >
        <UIcon name="i-lucide-calendar-clock" class="size-3" />
        Дедлайн
      </span>
      <span
        v-if="task.isEpic"
        class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300 text-[10px] font-bold uppercase tracking-[0.04em] shrink-0"
        title="Эпик"
      >
        <UIcon name="i-lucide-crown" class="size-3" />
        Эпик
      </span>
      <span
        v-if="task.storyPoints != null"
        class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-elevated text-default text-[11px] font-semibold tabular-nums shrink-0"
        title="Story points"
      >
        <span class="size-1.5 rounded-full bg-zinc-400" />
        {{ task.storyPoints }}
      </span>
    </div>

    <p
      class="text-[13px] font-medium leading-snug break-words line-clamp-3 mb-1.5"
      :class="isDone ? 'text-muted line-through' : 'text-default'"
    >
      {{ task.title }}
    </p>

    <div
      v-if="task.blockedReason"
      class="flex items-start gap-1.5 px-2 py-1 mb-1.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-[11.5px] font-medium leading-snug"
    >
      <UIcon name="i-lucide-alert-triangle" class="size-3.5 shrink-0 mt-px" />
      <span class="line-clamp-2">{{ task.blockedReason }}</span>
    </div>

    <div class="mb-1.5">
      <span
        v-if="sprintChip"
        class="inline-flex items-center gap-1 max-w-full h-[18px] px-1.5 rounded bg-elevated text-muted text-[10.5px] font-medium"
        :title="`В спринте: ${sprintChip.name}`"
      >
        <UIcon name="i-lucide-iteration-ccw" class="size-3 shrink-0" />
        <span class="truncate">{{ sprintChip.name }}</span>
      </span>
      <span
        v-else
        class="inline-flex items-center gap-1 h-[18px] px-1.5 rounded border border-dashed border-default text-dimmed text-[10.5px] font-medium"
      >
        <UIcon name="i-lucide-iteration-ccw" class="size-3 shrink-0" />
        Не в спринте
      </span>
    </div>

    <div class="flex items-center gap-2 min-h-[22px]">
      <span
        v-if="dueState && dueState.tone === 'overdue'"
        class="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-red-500 text-white text-[10.5px] font-semibold tabular-nums"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ dueState.label }}
      </span>
      <span
        v-else-if="dueState && dueState.tone === 'today'"
        class="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-accent-500 text-white text-[10.5px] font-semibold tabular-nums"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ dueState.label }}
      </span>
      <span
        v-else-if="dueState && dueState.tone === 'soon'"
        class="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 tabular-nums"
      >
        <UIcon name="i-lucide-calendar" class="size-3 text-accent-500" />
        {{ dueState.label }}
      </span>
      <span
        v-else-if="dueState"
        class="inline-flex items-center gap-1 text-[11px] text-muted tabular-nums"
      >
        <UIcon name="i-lucide-calendar" class="size-3 text-dimmed" />
        {{ dueState.label }}
      </span>

      <span
        v-if="blockerCount > 0"
        class="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium"
        :title="`Заблокирована ${blockerCount} задачами`"
      >
        <UIcon name="i-lucide-lock" class="size-3" />
        {{ blockerCount }}
      </span>

      <span
        v-if="agingTier.show"
        :class="[
          'inline-flex items-center gap-1 px-1.5 h-[18px] rounded text-[10.5px] font-medium leading-none',
          agingTier.chipClass,
        ]"
        :title="agingTooltip"
      >
        <UIcon name="i-lucide-clock" class="size-3" />
        {{ Math.round(ageDaysFromIso(task.createdAt)) }}д
      </span>

      <div class="flex-1" />

      <div class="flex items-center">
        <template v-if="visibleAssignees.length > 0">
          <div class="flex items-center -space-x-1.5">
            <UserAvatar
              v-for="member in visibleAssignees"
              :key="member.userId"
              :user="member"
              size="sm"
              tooltip
              ring
            />
            <div
              v-if="hiddenAssigneesCount > 0"
              class="size-6 rounded-full bg-elevated text-muted text-[10px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-zinc-800"
              :title="`Ещё ${hiddenAssigneesCount}`"
            >
              +{{ hiddenAssigneesCount }}
            </div>
          </div>
        </template>
        <span
          v-else
          class="size-6 rounded-full border border-dashed border-default text-dimmed grid place-items-center text-[10px]"
          title="Не назначено"
        >·</span>
      </div>
    </div>
  </div>
</template>
