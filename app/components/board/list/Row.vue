<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  task: Task
  isDone: boolean
  members: MemberView[]
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
</script>

<template>
  <div
    class="group grid grid-cols-[var(--kl-cols)] items-center pr-3.5 min-h-[44px] border-b border-[var(--ui-border-muted)] last:border-b-0 cursor-pointer relative transition-colors"
    :class="selected ? 'bg-accent-50 dark:bg-accent-950/40' : depth > 0 ? 'bg-muted/40 hover:bg-muted' : 'hover:bg-muted'"
    @click="openTask"
  >
    <span
      class="absolute left-0 top-0 bottom-0 w-[3px]"
      :class="task.serviceClass === 'expedite' && !isDone ? 'bg-accent-500' : 'bg-transparent'"
    />

    <div class="flex items-center gap-[9px] py-2 pr-2.5 min-w-0" :style="{ paddingLeft: `${14 + depth * 22}px` }">
      <span
        v-if="depth > 0"
        class="text-dimmed shrink-0 -ml-3.5 mr-0.5 font-mono text-[11px] select-none"
        aria-hidden="true"
      >└</span>

      <span
        class="size-[17px] rounded-[5px] border-[1.6px] grid place-items-center shrink-0 transition-colors"
        :class="selected
          ? 'opacity-100 bg-accent-500 border-accent-500 text-white'
          : 'opacity-0 group-hover:opacity-100 border-[var(--ui-border-accented)] bg-default text-transparent hover:border-muted'"
        @click.stop="emit('toggle-select', task.id)"
      >
        <UIcon name="i-lucide-check" class="size-3" />
      </span>

      <button
        v-if="childCount > 0"
        type="button"
        class="size-4 grid place-items-center shrink-0 text-muted hover:text-default transition-transform"
        :class="expanded ? '' : '-rotate-90'"
        @click.stop="emit('toggle-expand', task.id)"
      >
        <UIcon name="i-lucide-chevron-down" class="size-4" />
      </button>

      <span
        class="size-4 rounded-full shrink-0 grid place-items-center"
        :class="isDone ? 'bg-emerald-500 text-white' : hasBlocker ? 'border-2 border-red-500' : 'border-2 border-[var(--ui-text-dimmed)]'"
      >
        <UIcon v-if="isDone" name="i-lucide-check" class="size-[11px]" />
      </span>

      <span class="font-mono text-[10.5px] text-muted shrink-0 tracking-tight">{{ shortId }}</span>

      <span
        class="text-[13px] truncate min-w-0"
        :class="isDone ? 'text-muted line-through' : 'text-default'"
      >{{ task.title }}</span>

      <span
        v-if="task.serviceClass === 'expedite' && !isDone"
        class="inline-flex items-center gap-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-accent-600 dark:text-accent-300 bg-accent-50 dark:bg-accent-950 px-[5px] py-px rounded-[3px] shrink-0"
      >
        <UIcon name="i-lucide-zap" class="size-3" />
        Срочная
      </span>

      <span class="inline-flex items-center gap-[7px] shrink-0 ml-0.5">
        <span v-if="childCount > 0" class="inline-flex items-center gap-1 text-[10.5px] text-muted tabular-nums">
          <UIcon name="i-lucide-git-branch" class="size-3" />{{ childCount }}
        </span>
        <span v-if="hasBlocker" class="text-red-500"><UIcon name="i-lucide-alert-triangle" class="size-3.5" /></span>
        <span
          v-if="task.checklistTotal > 0"
          class="inline-flex items-center gap-1 text-[10.5px] tabular-nums"
          :class="checklistFull ? 'text-emerald-600' : 'text-muted'"
        >
          <UIcon name="i-lucide-check-square" class="size-3" />{{ task.checklistDone }}/{{ task.checklistTotal }}
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

    <div class="flex items-center px-2.5 h-full border-l border-[var(--ui-border-muted)]" @click.stop>
      <BoardListAssigneeCell
        :task="task" :assignees="assignees" :members="members" :can-edit="canCreate"
        :workspace-id="workspaceId" :board-id="boardId"
      />
    </div>

    <div class="flex items-center px-2.5 h-full border-l border-[var(--ui-border-muted)]" @click.stop>
      <BoardListDueCell :task="task" :due="due" :is-done="isDone" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center px-2.5 h-full border-l border-[var(--ui-border-muted)] col-class" @click.stop>
      <BoardListClassCell :task="task" :cos="cos" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center justify-center px-2.5 h-full border-l border-[var(--ui-border-muted)] col-sp" @click.stop>
      <BoardListSpCell :task="task" :can-edit="canCreate" :workspace-id="workspaceId" :board-id="boardId" />
    </div>

    <div class="flex items-center px-2.5 h-full border-l border-[var(--ui-border-muted)] col-clist">
      <span v-if="task.checklistTotal > 0" class="inline-flex items-center gap-[7px] w-full">
        <span class="flex-1 h-1 bg-elevated rounded-full overflow-hidden min-w-[36px]">
          <span class="block h-full rounded-full" :class="checklistFull ? 'bg-emerald-500' : 'bg-accent-500'" :style="{ width: `${task.checklistDone / task.checklistTotal * 100}%` }" />
        </span>
        <span class="font-mono text-[10.5px] text-muted whitespace-nowrap">{{ task.checklistDone }}/{{ task.checklistTotal }}</span>
      </span>
      <span v-else class="text-dimmed text-xs">—</span>
    </div>
  </div>
</template>
