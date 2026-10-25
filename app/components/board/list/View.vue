<script setup lang="ts">
import { onKeyStroke, useActiveElement, useScroll } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { Task, CreateTaskInput } from '#shared/types/task'
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'
import type { GroupBy, ListGroup } from '~/utils/list-groups'
import { columnHex } from '~/utils/column-color'
import { listColumnsTemplate, visibleColumns } from '~/utils/list-columns'

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
const columnPill = (c: Column) => columnHex(c)

const childrenByParent = computed(() => buildChildrenByParent(props.tasks))

const { list: membershipsList } = useBoardSprintMembershipsApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))
const visibleCols = computed(() => {
  const openSprintTasks = new Set((membershipsList.data.value?.memberships ?? []).map(m => m.taskId))
  return visibleColumns(props.tasks, openSprintTasks)
})
const colsStyle = computed(() => ({ '--kl-cols': listColumnsTemplate(visibleCols.value) }))
const hiddenColsClass = computed(() => (['sprint', 'checklist', 'time'] as const).filter(c => !visibleCols.value.has(c)).map(c => `hide-${c}`))
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
let lastToggled: string | null = null

const visibleOrder = computed(() => groups.value.flatMap(g => collapsed.value.has(g.key)
  ? []
  : g.tasks.flatMap(t => [t.id, ...(expanded.value.has(t.id) ? (childrenByParent.value.get(t.id) ?? []).map(c => c.id) : [])])))

function toggleSelect(id: string, shift = false) {
  const n = new Set(selected.value)
  const order = visibleOrder.value
  const from = lastToggled ? order.indexOf(lastToggled) : -1
  const to = order.indexOf(id)
  if (shift && from !== -1 && to !== -1) {
    for (const rangeId of order.slice(Math.min(from, to), Math.max(from, to) + 1)) n.add(rangeId)
  }
  else if (n.has(id)) n.delete(id)
  else n.add(id)
  lastToggled = id
  selected.value = n
}
function selectGroup(ids: string[], on: boolean) {
  const n = new Set(selected.value)
  for (const id of ids) {
    if (on) n.add(id)
    else n.delete(id)
  }
  selected.value = n
}
function clearSelection() {
  selected.value = new Set()
  lastToggled = null
}

watch(() => props.tasks, (list) => {
  const alive = new Set(list.map(t => t.id))
  if ([...selected.value].some(id => !alive.has(id))) {
    selected.value = new Set([...selected.value].filter(id => alive.has(id)))
  }
})

const activeElement = useActiveElement()
onKeyStroke('Escape', () => {
  const el = activeElement.value
  const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  if (selected.value.size && !typing && !document.querySelector('[role="dialog"], [role="menu"]')) clearSelection()
})

const backlogColumnId = computed(() => {
  const backlog = props.columns.find(c => c.columnRole === 'backlog')
  return backlog?.id ?? props.columns[0]?.id ?? null
})

async function addSubtask(parentId: string) {
  if (!backlogColumnId.value) return
  const input: CreateTaskInput = {
    columnId: backlogColumnId.value,
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
  <div ref="scrollEl" class="overflow-auto pb-24" :class="hiddenColsClass" :style="colsStyle">
    <div class="space-y-6 px-3 pt-2 sm:px-5">
      <BoardListGroup
        v-for="g in groups" :key="g.key"
        :group="g" :children-by-parent="childrenByParent" :members="members" :columns="columns" :dep-counts="depCounts"
        :collapsed="collapsed.has(g.key)" :selected="selected" :expanded="expanded"
        :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
        @toggle-collapse="toggleCollapse" @toggle-select="toggleSelect" @select-group="selectGroup" @toggle-expand="toggleExpand"
        @add-subtask="addSubtask" @move-to-column="moveToColumn" @create-in-column="emit('create-in-column', $event)"
      />
    </div>

    <BoardListBulkBar
      v-if="selected.size > 0"
      :selected="selected" :tasks="tasks" :columns="columns" :members="members"
      :memberships="membershipsList.data.value?.memberships ?? []"
      :workspace-id="workspaceId" :board-id="boardId"
      @clear="clearSelection"
      @narrow="selected = new Set($event)"
    />
  </div>
</template>
