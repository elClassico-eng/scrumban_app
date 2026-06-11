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
</script>

<template>
  <div
    class="group grid grid-cols-[var(--kl-cols)] items-center min-h-[38px] border-b border-[var(--ui-border-muted)] cursor-pointer relative transition-colors"
    :class="selected ? 'bg-accent-50 dark:bg-accent-950/40' : depth > 0 ? 'bg-muted/30 hover:bg-muted' : 'hover:bg-muted'"
    @click="openTask"
  >
    <div class="flex items-center gap-2 py-1.5 pr-2 min-w-0" :style="{ paddingLeft: `${10 + depth * 26}px` }">
      <span
        v-if="depth > 0"
        class="shrink-0 -ml-[18px] mr-0.5 w-3.5 h-3.5 -translate-y-[3px] border-l-[1.5px] border-b-[1.5px] border-[var(--ui-border-accented)] rounded-bl-[5px]"
        aria-hidden="true"
      />

      <span
        class="size-4 rounded border-[1.5px] grid place-items-center shrink-0 transition-all"
        :class="selected
          ? 'opacity-100 bg-accent-500 border-accent-500 text-white'
          : 'opacity-0 group-hover:opacity-100 border-[var(--ui-border-accented)] bg-default text-transparent hover:border-muted'"
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
          class="size-[15px] rounded-full border-2 grid place-items-center shrink-0 transition-colors hover:scale-110"
          :class="[hasBlocker ? 'border-red-500 text-red-500' : circleClass, isDone ? 'bg-current' : '']"
          title="Сменить статус"
          @click.stop
        >
          <UIcon v-if="isDone" name="i-lucide-check" class="size-2.5 text-white" />
        </button>
      </UDropdownMenu>

      <span class="font-mono text-[10px] text-dimmed shrink-0 tracking-tight">{{ shortId }}</span>

      <span
        class="text-[13px] truncate min-w-0"
        :class="isDone ? 'text-dimmed line-through' : depth > 0 ? 'text-toned' : 'text-default'"
      >{{ task.title }}</span>

      <span
        v-if="task.serviceClass === 'expedite' && !isDone"
        class="inline-flex items-center gap-[3px] text-[9px] font-bold uppercase tracking-[0.03em] text-accent-600 dark:text-accent-300 bg-accent-50 dark:bg-accent-950 px-1.5 h-[15px] rounded shrink-0"
      >
        <UIcon name="i-lucide-zap" class="size-2.5" />
        Срочно
      </span>

      <span class="inline-flex items-center gap-1.5 shrink-0 ml-0.5">
        <span v-if="hasBlocker" class="text-red-500"><UIcon name="i-lucide-alert-triangle" class="size-3" /></span>
        <span
          v-if="task.checklistTotal > 0"
          class="inline-flex items-center gap-0.5 text-[10px] tabular-nums"
          :class="checklistFull ? 'text-emerald-600' : 'text-dimmed'"
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

    <div class="flex items-center px-2 h-full min-w-0" @click.stop>
      <BoardListAssigneeCell
        :task="task" :assignees="assignees" :members="members" :can-edit="canCreate"
        :workspace-id="workspaceId" :board-id="boardId"
      />
    </div>

    <div class="flex items-center px-2 h-full min-w-0" @click.stop>
      <BoardListDueCell :task="task" :due="due" :is-done="isDone" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center px-2 h-full min-w-0 col-class" @click.stop>
      <BoardListClassCell :task="task" :cos="cos" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center justify-center px-2 h-full col-sp" @click.stop>
      <BoardListSpCell :task="task" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center px-2 h-full col-clist">
      <span v-if="task.checklistTotal > 0" class="inline-flex items-center gap-1.5 w-full">
        <span class="flex-1 h-1 bg-elevated rounded-full overflow-hidden min-w-[28px]">
          <span class="block h-full rounded-full" :class="checklistFull ? 'bg-emerald-500' : 'bg-accent-500'" :style="{ width: `${task.checklistDone / task.checklistTotal * 100}%` }" />
        </span>
        <span class="font-mono text-[10px] text-dimmed whitespace-nowrap">{{ task.checklistDone }}/{{ task.checklistTotal }}</span>
      </span>
      <span v-else class="text-dimmed text-xs">—</span>
    </div>

    <div class="flex items-center px-2 h-full col-time">
      <BoardListTimeCell :task="task" />
    </div>
  </div>
</template>
