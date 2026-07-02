<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
import type { BoardColumn as Column } from '#shared/types/column'

const props = defineProps<{
  task: Task
  isDone: boolean
  members: MemberView[]
  columns: Column[]
  blockerCount: number
  childCount: number
  expanded: boolean
  selected: boolean
  depth: number
  canCreate: boolean
  workspaceId: string
  boardId: string
}>()

const emit = defineEmits<{
  'toggle-select': [id: string]
  'toggle-expand': [id: string]
  'add-subtask': [id: string]
  'move-to-column': [taskId: string, columnId: string]
}>()

const router = useRouter()
const route = useRoute()
function openTask() {
  router.push({ path: route.path, query: { ...route.query, task: props.task.id } })
}

const memberById = computed(() => {
  const m = new Map<string, MemberView>()
  for (const x of props.members) m.set(x.userId, x)
  return m
})
const assignees = computed(() =>
  (props.task.assigneeIds ?? []).map(id => memberById.value.get(id)).filter((x): x is MemberView => !!x),
)
const shortId = computed(() => props.task.id.slice(0, 6).toUpperCase())
const hasBlocker = computed(() => !!props.task.blockedReason || props.blockerCount > 0)
const cos = computed(() => SERVICE_CLASS_INFO[props.task.serviceClass])
const checklistFull = computed(() => props.task.checklistTotal > 0 && props.task.checklistDone === props.task.checklistTotal)
const due = computed(() => dueInfo(props.task.dueDate))

const column = computed(() => props.columns.find(c => c.id === props.task.columnId) ?? null)
const circleClass = computed(() => column.value ? COLUMN_ROLE_INFO[column.value.columnRole].circleClass : 'border-[var(--ui-text-dimmed)] text-[var(--ui-text-dimmed)]')
const columnItems = computed(() =>
  props.columns.map(c => ({
    label: c.name,
    icon: c.id === props.task.columnId ? 'i-lucide-check' : undefined,
    onSelect: () => emit('move-to-column', props.task.id, c.id),
  })),
)

const isExpedite = computed(() => props.task.serviceClass === 'expedite')

const duePillClass = computed(() => {
  const d = due.value
  if (!d) return 'bg-transparent text-dimmed pl-0'
  if (props.isDone) return 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
  if (d.tone === 'overdue') return 'bg-red-500 text-white'
  if (d.tone === 'today') return 'bg-accent-500 text-white'
  if (d.tone === 'soon') return 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-400'
  return 'bg-elevated text-toned'
})

const dueText = computed(() => {
  const d = due.value
  if (!d) return '—'
  if (d.tone === 'today' && !props.isDone) return 'сегодня'
  if (d.tone === 'soon' && d.diff === 1 && !props.isDone) return 'завтра'
  return d.dateLabel
})

const classPillClass = computed(() => {
  switch (props.task.serviceClass) {
    case 'expedite': return 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-400'
    case 'intangible': return 'bg-muted/50 text-dimmed'
    default: return 'bg-elevated text-toned'
  }
})

const classDotClass = computed(() => {
  switch (props.task.serviceClass) {
    case 'expedite': return 'bg-accent-500'
    case 'intangible': return 'bg-dimmed'
    default: return 'bg-zinc-400 dark:bg-zinc-500'
  }
})
</script>

<template>
  <div
    class="group relative cursor-pointer transition-colors border-t border-[var(--ui-border-muted)]"
    :class="[
      selected ? 'bg-accent-50 dark:bg-accent-950/40' : depth > 0 ? 'bg-muted/20 hover:bg-muted/40' : 'hover:bg-muted/30 dark:hover:bg-muted/20',
    ]"
    @click="openTask"
  >
    <span
      class="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
      :class="isExpedite && !isDone ? 'bg-accent-500' : 'bg-transparent'"
      aria-hidden="true"
    />

    <div class="sm:hidden flex flex-col gap-1 px-4 py-2.5" :style="{ paddingLeft: `${16 + depth * 20}px` }">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="size-4 rounded border-[1.5px] grid place-items-center shrink-0 transition-all"
          :class="selected
            ? 'opacity-100 bg-accent-500 border-accent-500 text-white'
            : 'opacity-0 group-hover:opacity-100 border-[var(--ui-border-accented)] bg-default text-transparent'"
          @click.stop="emit('toggle-select', task.id)"
        >
          <UIcon name="i-lucide-check" class="size-2.5" />
        </span>

        <UDropdownMenu :items="columnItems" :ui="{ content: 'w-48' }">
          <button
            class="size-[15px] rounded-full border-2 grid place-items-center shrink-0 transition-colors hover:scale-110"
            :class="[hasBlocker ? 'border-red-500 text-red-500' : circleClass, isDone ? 'bg-current' : '']"
            title="Сменить статус"
            @click.stop
          >
            <UIcon v-if="isDone" name="i-lucide-check" class="size-2.5 text-white" />
          </button>
        </UDropdownMenu>

        <span class="font-mono text-[10px] text-dimmed shrink-0">{{ shortId }}</span>

        <span
          class="text-[13px] font-medium truncate min-w-0"
          :class="isDone ? 'text-dimmed line-through' : depth > 0 ? 'text-toned' : 'text-default'"
        >{{ task.title }}</span>

        <span v-if="hasBlocker" class="text-red-500 shrink-0"><UIcon name="i-lucide-alert-triangle" class="size-3" /></span>
      </div>

      <div class="flex items-center flex-wrap gap-1.5 pl-[26px]">
        <template v-if="assignees.length > 0">
          <span class="inline-flex">
            <UserAvatar v-for="(m, i) in assignees.slice(0, 3)" :key="m.userId" :user="m" size="xs" ring :class="i > 0 ? '-ml-[7px]' : ''" />
          </span>
        </template>

        <span
          v-if="due"
          class="inline-flex items-center gap-[5px] h-[22px] px-2 rounded-[6px] text-[11px] font-medium tabular-nums"
          :class="duePillClass"
        >
          <UIcon name="i-lucide-calendar" class="size-2.5 shrink-0" />
          {{ dueText }}
        </span>

        <span
          class="inline-flex items-center gap-[5px] h-[22px] px-2 rounded-[6px] text-[11px] font-medium"
          :class="classPillClass"
        >
          <span class="size-1.5 rounded-full shrink-0" :class="classDotClass" />
          {{ cos.shortLabel }}
        </span>

        <span
          v-if="task.storyPoints != null"
          class="font-mono text-[11px] font-semibold tabular-nums h-[22px] px-1.5 rounded-[6px] bg-elevated text-toned inline-grid place-items-center"
        >
          {{ task.storyPoints }}
        </span>

        <span
          v-if="task.checklistTotal > 0"
          class="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] bg-elevated"
        >
          <span class="w-10 h-1 bg-muted rounded-full overflow-hidden">
            <span
              class="block h-full rounded-full"
              :class="checklistFull ? 'bg-emerald-500' : 'bg-accent-500'"
              :style="{ width: `${task.checklistDone / task.checklistTotal * 100}%` }"
            />
          </span>
          <span class="font-mono text-[10px] tabular-nums" :class="checklistFull ? 'text-emerald-600 dark:text-emerald-400' : 'text-dimmed'">
            {{ task.checklistDone }}/{{ task.checklistTotal }}
          </span>
        </span>

        <span
          v-if="task.timeSpentSeconds > 0"
          class="inline-flex items-center gap-[5px] font-mono text-[11px] text-muted h-[22px] px-2 rounded-[6px] bg-elevated"
        >
          <UIcon name="i-lucide-clock" class="size-2.5" />
          {{ formatDuration(task.timeSpentSeconds) }}
        </span>
      </div>
    </div>

    <div
      class="hidden sm:grid grid-cols-[var(--kl-cols)] items-center min-h-[48px] pr-[18px]"
    >
      <div class="flex items-center gap-2 py-2 pr-2 min-w-0" :style="{ paddingLeft: `${18 + depth * 26}px` }">
        <span
          v-if="depth > 0"
          class="shrink-0 -ml-[18px] mr-0.5 w-3.5 h-3.5 -translate-y-[3px] border-l-[1.5px] border-b-[1.5px] border-[var(--ui-border-accented)] rounded-bl-[5px]"
          aria-hidden="true"
        />

        <span
          class="size-[17px] rounded-[5px] border-[1.6px] grid place-items-center shrink-0 transition-all"
          :class="selected
            ? 'opacity-100 bg-accent-500 border-accent-500 text-white'
            : 'opacity-0 group-hover:opacity-100 border-[var(--ui-border-accented)] bg-default text-transparent'"
          @click.stop="emit('toggle-select', task.id)"
        >
          <UIcon name="i-lucide-check" class="size-2.5" />
        </span>

        <button
          v-if="childCount > 0"
          type="button"
          class="size-3.5 grid place-items-center shrink-0 text-dimmed hover:text-default transition-transform"
          :class="expanded ? '' : '-rotate-90'"
          @click.stop="emit('toggle-expand', task.id)"
        >
          <UIcon name="i-lucide-chevron-down" class="size-3.5" />
        </button>
        <span v-else class="w-3.5 shrink-0" />

        <UDropdownMenu :items="columnItems" :ui="{ content: 'w-48' }">
          <button
            class="size-[16px] rounded-full border-2 grid place-items-center shrink-0 transition-colors hover:scale-110"
            :class="[hasBlocker ? 'border-red-500 text-red-500' : circleClass, isDone ? 'bg-current' : '']"
            title="Сменить статус"
            @click.stop
          >
            <UIcon v-if="isDone" name="i-lucide-check" class="size-2.5 text-white" />
          </button>
        </UDropdownMenu>

        <span class="font-mono text-[10.5px] text-dimmed shrink-0 tracking-tight">{{ shortId }}</span>

        <span
          class="text-[13.5px] font-medium truncate min-w-0"
          :class="isDone ? 'text-dimmed line-through' : depth > 0 ? 'text-toned' : 'text-default'"
        >{{ task.title }}</span>

        <span class="inline-flex items-center gap-[7px] shrink-0 ml-0.5">
          <span v-if="hasBlocker" class="text-red-500"><UIcon name="i-lucide-alert-triangle" class="size-3" /></span>
          <span
            v-if="task.checklistTotal > 0"
            class="inline-flex items-center gap-0.5 text-[10px] tabular-nums"
            :class="checklistFull ? 'text-emerald-600 dark:text-emerald-400' : 'text-dimmed'"
          >
            <UIcon name="i-lucide-check-square" class="size-2.5" />{{ task.checklistDone }}/{{ task.checklistTotal }}
          </span>
          <button
            v-if="canCreate"
            type="button"
            class="size-5 grid place-items-center rounded text-dimmed opacity-0 group-hover:opacity-100 hover:bg-elevated hover:text-accent-500 transition-colors"
            title="Добавить подзадачу"
            @click.stop="emit('add-subtask', task.id)"
          >
            <UIcon name="i-lucide-plus" class="size-3.5" />
          </button>
        </span>
      </div>

      <div class="flex items-center justify-center px-2.5 h-full min-w-0" @click.stop>
        <BoardListAssigneeCell
          :task="task" :assignees="assignees" :members="members" :can-edit="canCreate"
          :workspace-id="workspaceId" :board-id="boardId"
        />
      </div>

      <div class="flex items-center px-2.5 h-full min-w-0" @click.stop>
        <BoardListDueCell :task="task" :due="due" :is-done="isDone" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
      </div>

      <div class="flex items-center px-2.5 h-full min-w-0 col-class" @click.stop>
        <BoardListClassCell :task="task" :cos="cos" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
      </div>

      <div class="flex items-center justify-center px-2 h-full col-sp" @click.stop>
        <BoardListSpCell :task="task" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
      </div>

      <div class="flex items-center px-2.5 h-full min-w-0 col-sprint">
        <BoardListSprintCell :task="task" :workspace-id="workspaceId" :board-id="boardId" />
      </div>

      <div class="flex items-center px-2.5 h-full col-clist">
        <span v-if="task.checklistTotal > 0" class="inline-flex items-center gap-2 w-full">
          <span class="flex-1 h-[5px] bg-elevated dark:bg-accented rounded-full overflow-hidden min-w-[28px]">
            <span
              class="block h-full rounded-full"
              :class="checklistFull ? 'bg-emerald-500' : 'bg-accent-500'"
              :style="{ width: `${task.checklistDone / task.checklistTotal * 100}%` }"
            />
          </span>
          <span
            class="font-mono text-[11px] whitespace-nowrap tabular-nums"
            :class="checklistFull ? 'text-emerald-600 dark:text-emerald-400' : 'text-dimmed'"
          >{{ task.checklistDone }}/{{ task.checklistTotal }}</span>
        </span>
        <span v-else class="text-dimmed text-xs">—</span>
      </div>

      <div class="flex items-center justify-center px-2 h-full col-time">
        <BoardListTimeCell :task="task" />
      </div>
    </div>
  </div>
</template>
