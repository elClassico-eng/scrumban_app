<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Task } from '#shared/types/task'
import type { BoardColumn as Column } from '#shared/types/column'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: columnsList, reorder: reorderColumns } = useColumnsApi(wsId, bId)
const { list: tasksList } = useTasksApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const { byTaskId: depCountsByTaskId } = useBoardDependencyCountsApi(wsId, bId)

useBoardSse(wsId, bId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const members = computed(() => membersList.data.value?.members ?? [])

const localColumns = ref<Column[]>([])
watch(columns, (next) => {
  localColumns.value = [...next]
}, { immediate: true })

function onColumnsReorder() {
  reorderColumns.mutate({ orderedIds: localColumns.value.map(c => c.id) })
}

type SwimlaneMode = 'none' | 'assignee' | 'service_class' | 'epic'
type ClassFilter = 'all' | 'expedite' | 'blocker'

const swimlane = ref<SwimlaneMode>('none')
const query = ref('')
const selectedAssignees = ref<Set<string>>(new Set())
const classFilter = ref<ClassFilter>('all')
const viewMode = computed<'board' | 'list'>(() => route.query.view === 'list' ? 'list' : 'board')

function toggleAssignee(userId: string | null) {
  if (userId === null) {
    selectedAssignees.value = new Set()
    return
  }
  const next = new Set(selectedAssignees.value)
  if (next.has(userId)) next.delete(userId)
  else next.add(userId)
  selectedAssignees.value = next
}

const expediteCount = computed(() =>
  tasks.value.filter(t => t.serviceClass === 'expedite').length,
)
const blockerCount = computed(() =>
  tasks.value.filter((t) => {
    if (t.blockedReason) return true
    return (depCountsByTaskId.value.get(t.id)?.blockerCount ?? 0) > 0
  }).length,
)

const filteredTasks = computed(() => {
  const q = query.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    if (classFilter.value === 'expedite' && t.serviceClass !== 'expedite') return false
    if (classFilter.value === 'blocker') {
      const hasBlocker = !!t.blockedReason || (depCountsByTaskId.value.get(t.id)?.blockerCount ?? 0) > 0
      if (!hasBlocker) return false
    }
    if (selectedAssignees.value.size > 0) {
      const ids = t.assigneeIds ?? []
      if (!ids.some(id => selectedAssignees.value.has(id))) return false
    }
    if (q && !t.title.toLowerCase().includes(q) && !t.id.toLowerCase().startsWith(q)) {
      return false
    }
    return true
  })
})

interface Lane {
  key: string
  label: string
  tasksByColumn: Map<string, Task[]>
}

const lanes = computed<Lane[]>(() => {
  const epics = new Map<string, string>()
  for (const t of tasks.value) {
    if (t.isEpic) epics.set(t.id, t.title)
  }
  const memberLabel = (id: string | null) => {
    if (!id) return 'Не назначен'
    const found = members.value.find(m => m.userId === id)
    return found ? displayName(found) : id.slice(0, 6)
  }
  const laneKey = (t: Task): string => {
    if (swimlane.value === 'none') return '__all__'
    if (swimlane.value === 'assignee') return t.assigneeId ?? '__none__'
    if (swimlane.value === 'service_class') return t.serviceClass
    if (swimlane.value === 'epic') {
      if (t.parentTaskId && epics.has(t.parentTaskId)) return t.parentTaskId
      return '__none__'
    }
    return '__all__'
  }
  const laneLabel = (key: string): string => {
    if (swimlane.value === 'none') return ''
    if (key === '__none__') return swimlane.value === 'epic' ? 'Без эпика' : 'Не назначен'
    if (swimlane.value === 'assignee') return memberLabel(key)
    if (swimlane.value === 'service_class') {
      return SERVICE_CLASS_INFO[key as keyof typeof SERVICE_CLASS_INFO]?.shortLabel ?? key
    }
    if (swimlane.value === 'epic') return epics.get(key) ?? key
    return key
  }

  const buckets = new Map<string, Task[]>()
  for (const t of filteredTasks.value) {
    if (swimlane.value === 'epic' && t.isEpic) continue
    const key = laneKey(t)
    const arr = buckets.get(key) ?? []
    arr.push(t)
    buckets.set(key, arr)
  }

  const result: Lane[] = []
  for (const [key, laneTasks] of buckets) {
    const tasksByColumn = new Map<string, Task[]>()
    for (const t of laneTasks) {
      const arr = tasksByColumn.get(t.columnId) ?? []
      arr.push(t)
      tasksByColumn.set(t.columnId, arr)
    }
    for (const [k, v] of tasksByColumn) {
      tasksByColumn.set(k, [...v].sort((a, b) => a.position - b.position))
    }
    result.push({ key, label: laneLabel(key), tasksByColumn })
  }
  result.sort((a, b) => {
    if (a.key === '__none__') return 1
    if (b.key === '__none__') return -1
    return a.label.localeCompare(b.label, 'ru')
  })
  return result
})

const canCreateColumns = computed(() => hasRole(workspace.value?.role, 'admin'))
const canCreateTasks = computed(() => hasRole(workspace.value?.role, 'member'))

const collapsedLanes = reactive(new Set<string>())
function toggleLane(key: string) {
  if (collapsedLanes.has(key)) collapsedLanes.delete(key)
  else collapsedLanes.add(key)
}

const openTaskId = computed(() => {
  const v = route.query.task
  return typeof v === 'string' && v.length > 0 ? v : null
})
const taskModalOpen = computed({
  get: () => openTaskId.value !== null,
  set: (v) => {
    if (!v) closeTaskModal()
  },
})
function closeTaskModal() {
  const { task: _drop, ...rest } = route.query
  router.push({ path: route.path, query: rest })
}

useHead({
  title: () => board.value
    ? `${board.value.name} — Scrumban`
    : 'Доска — Scrumban',
})

const createColumnOpen = ref(false)
const createTaskOpen = ref(false)
const createTaskColumnIdOverride = ref<string | null>(null)
const createTaskColumnId = computed(() => {
  if (createTaskColumnIdOverride.value) return createTaskColumnIdOverride.value
  const backlog = localColumns.value.find(c => c.columnRole === 'backlog')
  return backlog?.id ?? localColumns.value[0]?.id ?? null
})
function openCreateTask(columnId?: string) {
  createTaskColumnIdOverride.value = columnId ?? null
  if (createTaskColumnId.value) createTaskOpen.value = true
}

const ccActions = useControlCenterActions()
watch(() => ccActions.createTaskTick.value, () => openCreateTask())

const listCompact = ref(false)

const isLoading = computed(() =>
  columnsList.isLoading.value || tasksList.isLoading.value,
)
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <BoardSubnav
      :workspace-id="wsId"
      :board-id="bId"
      :board-name="board?.name"
      :can-rename="canCreateColumns"
      :board="board"
      :compact="viewMode === 'list' && listCompact"
    />

    <BoardFilterBar
      v-if="columns.length > 0"
      :swimlane="swimlane"
      :query="query"
      :selected-assignees="selectedAssignees"
      :class-filter="classFilter"
      :members="members"
      :expedite-count="expediteCount"
      :blocker-count="blockerCount"
      :can-create="canCreateTasks"
      class="-mx-4 sm:-mx-6 mt-3"
      @update:swimlane="swimlane = $event"
      @update:query="query = $event"
      @toggle-assignee="toggleAssignee"
      @update:class-filter="classFilter = $event"
      @create-task="openCreateTask"
    />

    <div v-if="isLoading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="columns.length === 0" class="text-center py-12 mt-4">
      <div class="space-y-3">
        <UIcon name="i-lucide-columns-3" class="size-12 text-muted mx-auto" />
        <div>
          <p class="font-medium">В доске пока нет колонок</p>
          <p class="text-sm text-muted mt-1">
            {{ canCreateColumns ? 'Создай первую, чтобы добавлять задачи.' : 'Попроси админа настроить колонки.' }}
          </p>
        </div>
        <UButton v-if="canCreateColumns" icon="i-lucide-plus" @click="createColumnOpen = true">
          Создать колонку
        </UButton>
      </div>
    </UCard>

    <BoardListView
      v-else-if="viewMode === 'list'"
      :tasks="filteredTasks"
      :group-by="swimlane"
      :columns="localColumns"
      :members="members"
      :dep-counts="depCountsByTaskId"
      :can-create="canCreateTasks"
      :workspace-id="wsId"
      :board-id="bId"
      class="flex-1 min-h-0 -mx-4 sm:-mx-6"
      @create-in-column="openCreateTask"
      @update:compact="listCompact = $event"
    />

    <div v-else-if="swimlane === 'none'" class="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pt-4 pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      <draggable
        v-model="localColumns"
        :group="{ name: 'columns' }"
        item-key="id"
        handle=".column-drag-handle"
        :disabled="!canCreateColumns"
        class="flex gap-3 h-full"
        animation="150"
        @end="onColumnsReorder"
      >
        <template #item="{ element }">
          <BoardColumn
            :column="element"
            :tasks="lanes[0]?.tasksByColumn.get(element.id) ?? []"
            :workspace-id="wsId"
            :board-id="bId"
            :can-create="canCreateTasks"
            :can-manage="canCreateColumns"
          />
        </template>
        <template #footer>
          <button
            v-if="canCreateColumns"
            type="button"
            class="w-[312px] shrink-0 rounded-xl border border-dashed border-default hover:border-accent-500 hover:bg-accent-50 text-muted hover:text-accent-600 flex items-center justify-center gap-2 text-[13px] transition-colors cursor-pointer self-start min-h-32"
            @click="createColumnOpen = true"
          >
            <UIcon name="i-lucide-plus" class="size-4" />
            Добавить колонку
          </button>
        </template>
      </draggable>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto space-y-4 pt-4 pb-4">
      <div v-for="lane in lanes" :key="lane.key" class="space-y-2">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-1 sticky top-0 bg-default/90 backdrop-blur-sm z-10 py-1 text-left hover:bg-accented/40 rounded transition-colors"
          @click="toggleLane(lane.key)"
        >
          <UIcon
            :name="collapsedLanes.has(lane.key) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            class="size-4 text-muted"
          />
          <h3 class="font-medium text-sm">{{ lane.label }}</h3>
          <span class="text-xs text-muted">
            {{ Array.from(lane.tasksByColumn.values()).reduce((n, arr) => n + arr.length, 0) }}
          </span>
        </button>
        <div v-if="!collapsedLanes.has(lane.key)" class="flex gap-3 overflow-x-auto pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <BoardColumn
            v-for="column in localColumns"
            :key="`${lane.key}:${column.id}`"
            :column="column"
            :tasks="lane.tasksByColumn.get(column.id) ?? []"
            :workspace-id="wsId"
            :board-id="bId"
            :can-create="canCreateTasks"
            :can-manage="false"
          />
        </div>
      </div>
    </div>

    <TaskFocusModal
      v-model:open="taskModalOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :task-id="openTaskId"
    />

    <BoardCreateColumnModal
      v-if="canCreateColumns"
      v-model:open="createColumnOpen"
      :workspace-id="wsId"
      :board-id="bId"
    />

    <TaskCreateModal
      v-if="canCreateTasks && createTaskColumnId"
      v-model:open="createTaskOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :column-id="createTaskColumnId"
    />
  </div>
</template>