<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { Task, CreateTaskInput } from '#shared/types/task'
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'
import type { GroupBy, ListGroup } from '~/utils/list-groups'

const props = defineProps<{
  tasks: Task[]
  groupBy: GroupBy
  columns: Column[]
  members: MemberView[]
  depCounts: Map<string, { blockerCount: number, blockedCount: number }>
  canCreate: boolean
  workspaceId: string
  boardId: string
}>()

const emit = defineEmits<{
  'update:compact': [boolean]
  'create-in-column': [columnId: string]
}>()

const { create, move } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))
const qc = useQueryClient()

const memberLabel = (id: string) => {
  const m = props.members.find(x => x.userId === id)
  return m ? displayName(m) : id.slice(0, 6)
}
const serviceClassLabel = (c: string) => SERVICE_CLASS_INFO[c as keyof typeof SERVICE_CLASS_INFO]?.shortLabel ?? c
const columnPill = (c: Column) => COLUMN_ROLE_INFO[c.columnRole].pillClass

const childrenByParent = computed(() => buildChildrenByParent(props.tasks))
const groups = computed<ListGroup[]>(() =>
  buildGroups(props.tasks, props.groupBy, props.columns, props.members, serviceClassLabel, columnPill, memberLabel),
)

const collapsed = ref<Set<string>>(new Set())
const expanded = ref<Set<string>>(new Set())
const selected = ref<Set<string>>(new Set())

function toggleCollapse(key: string) {
  const n = new Set(collapsed.value)
  if (n.has(key)) n.delete(key)
  else n.add(key)
  collapsed.value = n
}
function toggleExpand(id: string) {
  const n = new Set(expanded.value)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  expanded.value = n
}
function toggleSelect(id: string) {
  const n = new Set(selected.value)
  if (n.has(id)) n.delete(id)
  else n.add(id)
  selected.value = n
}
function clearSelection() {
  selected.value = new Set()
}

const backlogColumnId = computed(() => {
  const backlog = props.columns.find(c => c.columnRole === 'backlog')
  return backlog?.id ?? props.columns[0]?.id ?? null
})

async function addSubtask(parentId: string) {
  if (!backlogColumnId.value) return
  const parent = props.tasks.find(t => t.id === parentId)
  const input: CreateTaskInput = {
    columnId: parent?.columnId ?? backlogColumnId.value,
    title: 'Новая подзадача',
    parentTaskId: parentId,
    serviceClass: 'standard',
  }
  await create.mutateAsync(input)
  const n = new Set(expanded.value)
  n.add(parentId)
  expanded.value = n
}

async function moveToColumn(taskId: string, columnId: string) {
  const task = props.tasks.find(t => t.id === taskId)
  if (!task || task.columnId === columnId) return
  await move.mutateAsync({ taskId, toColumnId: columnId, toPosition: 0 })
  qc.invalidateQueries({ queryKey: ['tasks', props.workspaceId, props.boardId] })
}

const scrollEl = ref<HTMLElement | null>(null)
const { y } = useScroll(scrollEl)
watch(() => y.value > 6, v => emit('update:compact', v), { immediate: true })
</script>

<template>
  <div ref="scrollEl" class="overflow-auto px-4 sm:px-6 pb-16" style="--kl-cols: minmax(0,1fr) 92px 104px 116px 44px 116px">
    <div class="grid grid-cols-[var(--kl-cols)] items-center h-9 sticky top-0 z-30 bg-default/65 dark:bg-elevated/55 backdrop-blur-xl backdrop-saturate-150 border-b border-default">
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed pl-[34px]">Задача</span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed px-2">Исполн.</span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed px-2">Срок</span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed px-2 col-class">Класс</span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed px-2 text-center col-sp">SP</span>
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-dimmed px-2 col-clist">Чек-лист</span>
    </div>

    <BoardListGroup
      v-for="g in groups" :key="g.key"
      :group="g" :children-by-parent="childrenByParent" :members="members" :columns="columns" :dep-counts="depCounts"
      :collapsed="collapsed.has(g.key)" :selected="selected" :expanded="expanded"
      :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
      @toggle-collapse="toggleCollapse" @toggle-select="toggleSelect" @toggle-expand="toggleExpand"
      @add-subtask="addSubtask" @move-to-column="moveToColumn" @create-in-column="emit('create-in-column', $event)"
    />

    <BoardListBulkBar
      v-if="selected.size > 0"
      :selected="selected" :columns="columns" :members="members"
      :workspace-id="workspaceId" :board-id="boardId"
      @clear="clearSelection"
    />
  </div>
</template>
