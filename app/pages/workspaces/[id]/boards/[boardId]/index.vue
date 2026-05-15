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

// Open the SSE subscription for realtime invalidation while this page is mounted.
useBoardSse(wsId, bId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const tasks = computed(() => tasksList.data.value?.tasks ?? [])

const localColumns = ref<Column[]>([])
watch(columns, (next) => {
  localColumns.value = [...next]
}, { immediate: true })

function onColumnsReorder() {
  reorderColumns.mutate({ orderedIds: localColumns.value.map(c => c.id) })
}

type SwimlaneMode = 'none' | 'assignee' | 'service_class' | 'epic'
const swimlane = ref<SwimlaneMode>('none')
const SWIMLANE_OPTIONS: Array<{ label: string; value: SwimlaneMode }> = [
  { label: 'Без группировки', value: 'none' },
  { label: 'По исполнителю', value: 'assignee' },
  { label: 'По классу обслуживания', value: 'service_class' },
  { label: 'По эпикам', value: 'epic' },
]

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
    const found = membersList.data.value?.members.find(m => m.userId === id)
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
  for (const t of tasks.value) {
    // In epic mode the epic task itself sits at the top of its lane; don't
    // also drop it into «Без эпика».
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

const isLoading = computed(() =>
  columnsList.isLoading.value || tasksList.isLoading.value,
)
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canCreateColumns" :board="board" />

    <div class="flex items-center justify-between gap-3">
      <USelect v-model="swimlane" :items="SWIMLANE_OPTIONS" size="sm" class="w-56" />
    </div>

    <div v-if="isLoading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="columns.length === 0" class="text-center py-12">
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

    <div v-else-if="swimlane === 'none'" class="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
      <draggable
        v-model="localColumns"
        :group="{ name: 'columns' }"
        item-key="id"
        handle=".column-drag-handle"
        :disabled="!canCreateColumns"
        class="flex gap-4"
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
      </draggable>
      <button
        v-if="canCreateColumns"
        type="button"
        class="w-72 shrink-0 rounded-lg border border-dashed border-default hover:border-primary/60 hover:bg-accented/40 text-muted hover:text-primary flex items-center justify-center gap-2 text-sm transition-colors min-h-32"
        @click="createColumnOpen = true"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        Добавить колонку
      </button>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
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
        <div v-if="!collapsedLanes.has(lane.key)" class="flex gap-4 overflow-x-auto pb-2">
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

    <UModal
      v-model:open="taskModalOpen"
      :ui="{
        content: 'w-[95vw] max-w-[1180px] p-0 rounded-2xl',
        overlay: 'bg-black/75 backdrop-blur-sm',
      }"
    >
      <template #content>
        <TaskFocusView
          v-if="openTaskId"
          :workspace-id="wsId"
          :board-id="bId"
          :task-id="openTaskId"
          @close="closeTaskModal"
        />
      </template>
    </UModal>

    <BoardCreateColumnModal
      v-if="canCreateColumns"
      v-model:open="createColumnOpen"
      :workspace-id="wsId"
      :board-id="bId"
    />
  </div>
</template>