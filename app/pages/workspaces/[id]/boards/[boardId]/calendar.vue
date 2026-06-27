<script setup lang="ts">
import type { CalendarFilters } from '~/utils/calendar'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

useBoardSse(wsId, bId)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: tasksList, update } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const authStore = useAuthStore()

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))
const currentUserId = computed(() => authStore.user?.id ?? null)

useHead({
  title: () => board.value ? `${board.value.name} — Календарь` : 'Календарь — Такт',
})

const anchor = ref(startOfMonth(new Date()))
const selectedDay = ref<Date | null>(null)
const filters = ref<CalendarFilters>({ mine: false, assigneeIds: [] })
const createOpen = ref(false)

const filtered = computed(() => filterTasks(tasks.value, filters.value, currentUserId.value))
const tasksByDay = computed(() => groupTasksByDay(filtered.value))
const agendaTasks = computed(() =>
  selectedDay.value
    ? filtered.value.filter(t => t.dueDate && sameDay(dueLocalDay(t.dueDate), selectedDay.value!))
    : filtered.value,
)

const columnsById = computed(() => {
  const out: Record<string, string> = {}
  for (const c of columnsList.data.value?.columns ?? []) out[c.id] = c.name
  return out
})

const backlogColumnId = computed(() => {
  const cols = columnsList.data.value?.columns ?? []
  return cols.find(c => c.columnRole === 'backlog')?.id ?? cols[0]?.id ?? null
})

const createInitialDue = computed(() => {
  const d = selectedDay.value
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function reschedule({ taskId, day }: { taskId: string, day: Date }) {
  update.mutate({ taskId, dueDate: endOfDayIso(day) })
}

function openTask(taskId: string) {
  router.push({ path: route.path, query: { ...route.query, task: taskId } })
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
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <BoardSubnav
      :workspace-id="wsId"
      :board-id="bId"
      :board-name="board?.name"
      :can-rename="canRenameBoard"
      :board="board"
    />

    <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 lg:gap-7 overflow-y-auto lg:overflow-hidden">
      <div class="lg:flex-1 lg:min-w-0 lg:border-r lg:border-default lg:pr-7">
        <CalendarMonthGrid
          :anchor="anchor"
          :selected-day="selectedDay"
          :tasks-by-day="tasksByDay"
          @update:anchor="anchor = $event"
          @select-day="selectedDay = $event"
          @reschedule="reschedule"
        />
      </div>

      <div class="lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col">
        <CalendarAgenda
          :tasks="agendaTasks"
          :selected-day="selectedDay"
          :members="members"
          :columns-by-id="columnsById"
          :filters="filters"
          @update:filters="filters = $event"
          @open-task="openTask"
          @create="createOpen = true"
          @clear-day="selectedDay = null"
        />
      </div>
    </div>

    <TaskCreateModal
      v-if="backlogColumnId"
      v-model:open="createOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :column-id="backlogColumnId"
      :initial-due-date="createInitialDue"
    />

    <TaskFocusModal
      v-model:open="taskModalOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :task-id="openTaskId"
    />
  </div>
</template>
