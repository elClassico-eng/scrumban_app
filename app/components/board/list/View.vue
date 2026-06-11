<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { CreateTaskInput } from '#shared/types/task'
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

const { create } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))

const memberLabel = (id: string) => {
  const m = props.members.find(x => x.userId === id)
  return m ? displayName(m) : id.slice(0, 6)
}
const serviceClassLabel = (c: string) => SERVICE_CLASS_INFO[c as keyof typeof SERVICE_CLASS_INFO]?.shortLabel ?? c
const columnPill = (c: Column) => COLUMN_ROLE_INFO[c.columnRole].pillClass

const childrenByParent = computed(() => buildChildrenByParent(props.tasks))
const topLevel = computed(() => buildTopLevel(props.tasks))
const groups = computed<ListGroup[]>(() =>
  buildGroups(topLevel.value, props.groupBy, props.columns, props.members, serviceClassLabel, columnPill, memberLabel),
)

const collapsed = ref<Set<string>>(new Set())
const expanded = ref<Set<string>>(new Set())
const selected = ref<Set<string>>(new Set())

function toggleCollapse(key: string) {
  const n = new Set(collapsed.value)
  n.has(key) ? n.delete(key) : n.add(key)
  collapsed.value = n
}
function toggleExpand(id: string) {
  const n = new Set(expanded.value)
  n.has(id) ? n.delete(id) : n.add(id)
  expanded.value = n
}
function toggleSelect(id: string) {
  const n = new Set(selected.value)
  n.has(id) ? n.delete(id) : n.add(id)
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
  await create.mutateAsync({
    columnId: parent?.columnId ?? backlogColumnId.value,
    title: 'Новая подзадача',
    parentTaskId: parentId,
    serviceClass: 'standard',
  })
  const n = new Set(expanded.value)
  n.add(parentId)
  expanded.value = n
}

async function quickAdd(group: ListGroup, title: string) {
  const columnId = group.columnId ?? backlogColumnId.value
  if (!columnId) return
  const input: CreateTaskInput = { columnId, title, serviceClass: 'standard' }
  if (props.groupBy === 'assignee' && group.key.startsWith('a-') && group.key !== 'a-none') {
    input.assigneeId = group.key.slice(2)
  }
  if (props.groupBy === 'service_class' && group.key.startsWith('c-')) {
    input.serviceClass = group.key.slice(2) as CreateTaskInput['serviceClass']
  }
  if (props.groupBy === 'epic' && group.key.startsWith('e-') && group.key !== 'e-none') {
    input.parentTaskId = group.key.slice(2)
  }
  await create.mutateAsync(input)
}
</script>

<template>
  <div class="overflow-auto pt-3.5 px-4 sm:px-6 pb-10" style="--kl-cols: minmax(0,1fr) 116px 132px 130px 56px 150px">
    <div class="max-w-[1380px] mx-auto flex flex-col gap-[18px]">
      <BoardListGroup
        v-for="g in groups" :key="g.key"
        :group="g" :children-by-parent="childrenByParent" :members="members" :dep-counts="depCounts"
        :collapsed="collapsed.has(g.key)" :selected="selected" :expanded="expanded"
        :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
        @toggle-collapse="toggleCollapse" @toggle-select="toggleSelect" @toggle-expand="toggleExpand"
        @add-subtask="addSubtask" @quick-add="quickAdd"
      />
    </div>

    <BoardListBulkBar
      v-if="selected.size > 0"
      :selected="selected" :columns="columns" :members="members"
      :workspace-id="workspaceId" :board-id="boardId"
      @clear="clearSelection"
    />
  </div>
</template>
