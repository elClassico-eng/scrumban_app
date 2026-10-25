<script setup lang="ts">
import type { SprintState } from '#shared/types/domain'
import type { Sprint } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'
import { apiRoutes, pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: sprintsList, start, close, remove: removeSprint } = useSprintsApi(wsId, bId)
const { list: tasksList } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const { list: membershipsList } = useBoardSprintMembershipsApi(wsId, bId)

useSprintsRealtime(wsId, bId)

const allTasks = computed(() => tasksList.data.value?.tasks ?? [])
const columns = computed(() => columnsList.data.value?.columns ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const sprints = computed(() => sprintsList.data.value?.sprints ?? [])
const memberships = computed(() => membershipsList.data.value?.memberships ?? [])

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)

const canManage = computed(() => hasRole(workspace.value?.role, 'scrum_master'))
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value
    ? `${board.value.name} — Спринты`
    : 'Спринты – Такт',
})

type FilterKey = 'all' | SprintState
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активный' },
  { key: 'planned', label: 'Запланированы' },
  { key: 'closed', label: 'Закрытые' },
]

const filter = ref<FilterKey>('all')
const query = ref('')

const counts = computed(() => ({
  all: sprints.value.length,
  active: sprints.value.filter(s => s.state === 'active').length,
  planned: sprints.value.filter(s => s.state === 'planned').length,
  closed: sprints.value.filter(s => s.state === 'closed').length,
}))

const activeFilterLabel = computed(() => {
  const f = FILTERS.find(x => x.key === filter.value)
  return f ? `${f.label} · ${counts.value[f.key]}` : 'Все'
})
const filterMenu = computed(() =>
  FILTERS.map(f => ({
    label: `${f.label} (${counts.value[f.key]})`,
    icon: filter.value === f.key ? 'i-hugeicons-check' : undefined,
    onSelect: () => { filter.value = f.key },
  })),
)

function matchesQuery(s: Sprint): boolean {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return s.name.toLowerCase().includes(q) || (s.goal ?? '').toLowerCase().includes(q)
}

const visibleSprints = computed(() =>
  sprints.value.filter((s) => {
    if (filter.value !== 'all' && s.state !== filter.value) return false
    return matchesQuery(s)
  }),
)

const activeSprints = computed(() => visibleSprints.value.filter(s => s.state === 'active'))
const plannedSprints = computed(() => visibleSprints.value.filter(s => s.state === 'planned'))
const closedSprints = computed(() =>
  [...visibleSprints.value.filter(s => s.state === 'closed')].sort(
    (a, b) => new Date(b.endedAt ?? b.updatedAt).getTime() - new Date(a.endedAt ?? a.updatedAt).getTime(),
  ),
)

const taskById = computed(() => {
  const m = new Map<string, Task>()
  for (const t of allTasks.value) m.set(t.id, t)
  return m
})

const membershipBySprint = computed(() => {
  const m = new Map<string, { taskId: string; addedAt: string }[]>()
  for (const x of memberships.value) {
    const list = m.get(x.sprintId) ?? []
    list.push({ taskId: x.taskId, addedAt: x.addedAt })
    m.set(x.sprintId, list)
  }
  return m
})

function tasksForSprint(sprint: Sprint) {
  const startMs = sprint.startedAt ? new Date(sprint.startedAt).getTime() : null
  const items = membershipBySprint.value.get(sprint.id) ?? []
  return items
    .map((it) => {
      const task = taskById.value.get(it.taskId)
      if (!task) return null
      const addedMs = new Date(it.addedAt).getTime()
      const addedAfterStart = startMs !== null && addedMs > startMs + 60_000
      return { task, addedAfterStart }
    })
    .filter((x): x is { task: Task; addedAfterStart: boolean } => x !== null)
}

const activeSprintForBurndown = computed(() => activeSprints.value[0] ?? null)
const burndownSprintId = computed(() => activeSprintForBurndown.value?.id ?? '')
const { list: burndownQuery } = useSprintBurndownApi(wsId, bId, burndownSprintId)

const createOpen = ref(false)
const addTaskPanel = ref<{ sprint: Sprint } | null>(null)

const taskIdsInOpenSprints = computed(() => {
  const openSprintIds = new Set(
    sprints.value.filter(s => s.state !== 'closed').map(s => s.id),
  )
  const ids = new Set<string>()
  for (const it of memberships.value) {
    if (openSprintIds.has(it.sprintId)) ids.add(it.taskId)
  }
  return ids
})

function onWizardCreated() {
  tasksList.refetch()
  membershipsList.refetch()
}

const taskIdsInOtherSprints = computed(() => {
  if (!addTaskPanel.value) return new Set<string>()
  const ids = new Set<string>()
  for (const it of memberships.value) {
    if (it.sprintId === addTaskPanel.value.sprint.id) continue
    ids.add(it.taskId)
  }
  return ids
})

const backlogForAddPanel = computed(() => {
  const sprint = addTaskPanel.value?.sprint
  if (!sprint) return [] as Task[]
  const excludeTaskIds = new Set<string>([
    ...(membershipBySprint.value.get(sprint.id) ?? []).map(it => it.taskId),
    ...taskIdsInOtherSprints.value,
  ])
  return filterSprintCandidates(allTasks.value, {
    excludeTaskIds,
    terminalColumnIds: terminalColumnIds(columns.value),
  })
})

const toast = useToast()
const confirm = useConfirm()

async function onAddTasks(taskIds: string[]) {
  const sprint = addTaskPanel.value?.sprint
  if (!sprint) return
  try {
    await Promise.all(
      taskIds.map(id =>
        $fetch(apiRoutes.sprintTasks(wsId.value, bId.value, sprint.id), {
          method: 'POST',
          body: { taskId: id },
        }),
      ),
    )
    sprintsList.refetch()
    tasksList.refetch()
    membershipsList.refetch()
    addTaskPanel.value = null
    toast.add({
      title: `Добавлено ${taskIds.length} задач`,
      icon: 'i-hugeicons-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить задачи в спринт'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

async function onStart(sprint: Sprint) {
  try {
    await start.mutateAsync(sprint.id)
    toast.add({
      title: `Спринт «${sprint.name}» запущен`,
      icon: 'i-hugeicons-play',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось запустить спринт'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

const closeTarget = ref<Sprint | null>(null)
const closeDialogOpen = ref(false)

const closeOpenTasks = computed(() => {
  if (!closeTarget.value) return []
  return tasksForSprint(closeTarget.value)
    .map(t => t.task)
    .filter(t => t.closedAt === null)
})

function onClose(sprint: Sprint) {
  closeTarget.value = sprint
  closeDialogOpen.value = true
}

async function onCloseConfirm(payload: import('#shared/types/sprint').CloseSprintInput) {
  const sprint = closeTarget.value
  if (!sprint) return
  try {
    await close.mutateAsync({ sprintId: sprint.id, ...payload })
    closeDialogOpen.value = false
    tasksList.refetch()
    membershipsList.refetch()
    toast.add({
      title: `Спринт «${sprint.name}» закрыт`,
      icon: 'i-hugeicons-square-check-big',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось закрыть спринт'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

const editTarget = ref<Sprint | null>(null)
const editModalOpen = ref(false)

function onEdit(sprint: Sprint) {
  editTarget.value = sprint
  editModalOpen.value = true
}

async function onDelete(sprint: Sprint) {
  const ok = await confirm({
    title: `Удалить спринт «${sprint.name}»?`,
    description: 'Только запланированные спринты можно удалить. Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await removeSprint.mutateAsync(sprint.id)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить спринт'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

const router = useRouter()
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

const isLoading = computed(() => sprintsList.isLoading.value)
const isEmpty = computed(() =>
  !isLoading.value && sprints.value.length === 0,
)
const isFilteredEmpty = computed(() =>
  !isLoading.value
  && sprints.value.length > 0
  && visibleSprints.value.length === 0,
)
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <BoardSubnav
      :workspace-id="wsId"
      :board-id="bId"
      :board-name="board?.name"
      :can-rename="canRenameBoard"
      :board="board"
    />

    <UiPageHeader title="Спринты" :count="sprints.length > 0 ? sprints.length : undefined" class="pt-4 mb-3">
      <template #actions>
        <UInput
          v-model="query"
          icon="i-hugeicons-search-01"
          placeholder="Найти спринт…"
          size="md"
          class="w-full sm:w-56"
        />
        <UDropdownMenu :items="filterMenu" :ui="{ content: 'w-44' }" class="sm:hidden">
          <UButton color="neutral" variant="outline" size="md" trailing-icon="i-hugeicons-chevron-down" class="shrink-0">
            {{ activeFilterLabel }}
          </UButton>
        </UDropdownMenu>
        <div class="hidden sm:inline-flex items-center gap-0.5 rounded-lg bg-elevated p-0.5">
          <button
            v-for="f in FILTERS"
            :key="f.key"
            type="button"
            class="h-8 px-2.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="filter === f.key ? 'bg-default text-default shadow-sm' : 'text-muted hover:text-default'"
            @click="filter = f.key"
          >
            <span v-if="f.key === 'active' && counts.active > 0" class="size-1.5 rounded-full bg-accent-500" />
            {{ f.label }}
            <span class="text-[10.5px] tabular-nums text-dimmed">{{ counts[f.key] }}</span>
          </button>
        </div>
        <UButton v-if="canManage" icon="i-hugeicons-plus" size="md" @click="createOpen = true">
          Создать спринт
        </UButton>
      </template>
    </UiPageHeader>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4">
      <div v-if="isLoading" class="text-center py-12 text-muted">
        <UIcon name="i-hugeicons-loader" class="animate-spin size-6" />
      </div>

      <UiEmptyState
        v-else-if="isEmpty"
        icon="i-hugeicons-calendar-check-in-01"
        title="Спринтов пока нет"
        :text="canManage ? 'Создай первый, чтобы запустить итерацию команды.' : 'Попроси scrum-мастера создать первый спринт.'"
      >
        <template v-if="canManage" #actions>
          <UButton icon="i-hugeicons-plus" @click="createOpen = true">
            Создать спринт
          </UButton>
        </template>
      </UiEmptyState>

      <div v-else class="min-w-0 space-y-8">
          <UiEmptyState
            v-if="isFilteredEmpty"
            icon="i-hugeicons-search-x"
            title="Ничего не нашлось"
            text="Попробуй сбросить фильтр или поиск."
          />

          <template v-else>
            <section v-if="activeSprints.length > 0" class="space-y-3">
              <h2 class="m-0 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                <span class="size-1.5 rounded-full bg-accent-500" />
                Активный
              </h2>

              <SprintActiveCard
                v-for="s in activeSprints"
                :key="s.id"
                :sprint="s"
                :tasks="tasksForSprint(s)"
                :columns="columns"
                :members="members"
                :burndown="s.id === activeSprintForBurndown?.id ? (burndownQuery.data.value ?? null) : null"
                :can-manage="canManage"
                :simulator-to="pageRoutes.sprintSimulator(wsId, bId, s.id)"
                @add-task="addTaskPanel = { sprint: s }"
                @close="onClose(s)"
                @edit="onEdit(s)"
              >
                <template v-if="s.id === activeSprintForBurndown?.id" #forecast>
                  <SprintNetworkForecastCard :workspace-id="wsId" :board-id="bId" :sprint-id="s.id" />
                </template>
              </SprintActiveCard>
            </section>

            <section v-if="plannedSprints.length > 0" class="space-y-3">
              <h2 class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Запланированы · {{ plannedSprints.length }}</h2>

              <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <SprintCard
                  v-for="s in plannedSprints"
                  :key="s.id"
                  :sprint="s"
                  :tasks="tasksForSprint(s)"
                  :columns="columns"
                  :members="members"
                  :can-manage="canManage"
                  :simulator-to="pageRoutes.sprintSimulator(wsId, bId, s.id)"
                  @add-task="addTaskPanel = { sprint: s }"
                  @start="onStart(s)"
                  @delete="onDelete(s)"
                  @edit="onEdit(s)"
                />
              </div>
            </section>

            <section v-if="closedSprints.length > 0" class="space-y-3">
              <h2 class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Закрытые · {{ closedSprints.length }}</h2>

              <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <SprintCard
                  v-for="s in closedSprints"
                  :key="s.id"
                  :sprint="s"
                  :tasks="tasksForSprint(s)"
                  :columns="columns"
                  :members="members"
                  :can-manage="canManage"
                  :report-to="pageRoutes.sprintReportPage(wsId, bId, s.id)"
                />
              </div>
            </section>
          </template>
      </div>
    </div>

    <SprintWizardModal
      v-if="canManage"
      v-model:open="createOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :all-tasks="allTasks"
      :columns="columns"
      :task-ids-in-sprints="taskIdsInOpenSprints"
      @created="onWizardCreated"
    />

    <SprintEditModal
      v-model:open="editModalOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :sprint="editTarget"
    />

    <SprintCloseDialog
      v-model:open="closeDialogOpen"
      :sprint="closeTarget"
      :open-tasks="closeOpenTasks"
      :has-next-planned="plannedSprints.length > 0"
      :closing="close.isPending.value"
      @confirm="onCloseConfirm"
    />

    <SprintAddTasksPanel
      v-if="addTaskPanel"
      :open="!!addTaskPanel"
      :sprint="addTaskPanel.sprint"
      :backlog="backlogForAddPanel"
      :columns="columns"
      :members="members"
      @update:open="addTaskPanel = null"
      @confirm="onAddTasks"
    />

    <TaskFocusModal
      v-model:open="taskModalOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :task-id="openTaskId"
    />
  </div>
</template>
