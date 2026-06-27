<script setup lang="ts">
import type { SprintState } from '#shared/types/domain'
import type { Sprint } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'
import { apiRoutes } from '~/routing'

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
    : 'Спринты — Такт',
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
    icon: filter.value === f.key ? 'i-lucide-check' : undefined,
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
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить задачи в спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onStart(sprint: Sprint) {
  try {
    await start.mutateAsync(sprint.id)
    toast.add({
      title: `Спринт «${sprint.name}» запущен`,
      icon: 'i-lucide-play',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось запустить спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onClose(sprint: Sprint) {
  const ok = await confirm({
    title: `Закрыть спринт «${sprint.name}»?`,
    description: 'Закрытый спринт больше нельзя запустить — состав задач замораживается для аналитики.',
    confirmLabel: 'Закрыть',
  })
  if (!ok) return
  try {
    await close.mutateAsync(sprint.id)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось закрыть спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
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
      icon: 'i-lucide-alert-circle',
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

    <div class="shrink-0 pt-4 pb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div class="flex items-center gap-3 sm:contents">
        <h1 class="text-[26px] font-semibold tracking-tight text-default m-0">
          Спринты
          <span v-if="sprints.length > 0" class="text-[18px] font-medium text-muted tabular-nums">
            · {{ sprints.length }}
          </span>
        </h1>
        <UButton
          v-if="canManage"
          icon="i-lucide-plus"
          size="md"
          class="ml-auto sm:hidden"
          @click="createOpen = true"
        >
          Спринт
        </UButton>
      </div>

      <div class="hidden sm:block sm:flex-1" />

      <div class="flex items-center gap-2 sm:contents">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="Найти спринт…"
          size="md"
          class="flex-1 sm:w-56 sm:flex-none"
        />

        <UDropdownMenu :items="filterMenu" :ui="{ content: 'w-44' }" class="sm:hidden">
          <UButton
            color="neutral"
            variant="outline"
            size="md"
            trailing-icon="i-lucide-chevron-down"
            class="shrink-0"
          >
            {{ activeFilterLabel }}
          </UButton>
        </UDropdownMenu>
      </div>

      <div class="hidden sm:inline-flex items-center gap-1 bg-default border border-default rounded-md p-0.5">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="h-7 px-2.5 rounded text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          :class="filter === f.key
            ? 'bg-inverted text-inverted'
            : 'bg-transparent text-muted hover:text-default'"
          @click="filter = f.key"
        >
          <span
            v-if="f.key === 'active' && counts.active > 0"
            class="size-1.5 rounded-full bg-accent-500"
          />
          {{ f.label }}
          <span
            class="text-[10.5px] tabular-nums px-1.5 py-0.5 rounded-full"
            :class="filter === f.key
              ? 'bg-white/15 text-white/85'
              : 'bg-elevated text-muted'"
          >
            {{ counts[f.key] }}
          </span>
        </button>
      </div>

      <UButton
        v-if="canManage"
        icon="i-lucide-plus"
        size="md"
        class="hidden sm:flex"
        @click="createOpen = true"
      >
        Создать спринт
      </UButton>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
      <div v-if="isLoading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="isEmpty" class="text-center py-10">
      <div class="space-y-3">
        <UIcon name="i-lucide-calendar-check-2" class="size-12 text-muted mx-auto" />
        <p class="font-medium">Спринтов пока нет</p>
        <p class="text-sm text-muted">
          {{ canManage ? 'Создай первый, чтобы запустить итерацию команды.' : 'Попроси scrum-мастера создать первый спринт.' }}
        </p>
        <UButton v-if="canManage" icon="i-lucide-plus" @click="createOpen = true">
          Создать спринт
        </UButton>
      </div>
    </UCard>

    <div v-else-if="isFilteredEmpty" class="text-center py-16 text-muted">
      <UIcon name="i-lucide-search-x" class="size-10 mx-auto mb-2" />
      <p class="text-sm">Ничего не нашлось — попробуй сбросить фильтр или поиск.</p>
    </div>

    <template v-else>
      <section v-if="activeSprints.length > 0" class="space-y-3">
        <div class="flex items-center gap-2.5">
          <h2 class="text-[12px] font-bold uppercase tracking-[0.08em] text-muted m-0 inline-flex items-center gap-2">
            <span class="relative inline-flex">
              <span class="size-2 rounded-full bg-accent-500" />
              <span class="absolute inset-0 rounded-full ring-2 ring-accent-500/40 animate-ping" />
            </span>
            Активный
          </h2>
          <span class="text-[11px] font-medium text-muted bg-elevated px-1.5 py-0.5 rounded-full">
            {{ activeSprints.length }}
          </span>
          <span class="flex-1 h-px bg-accented" />
        </div>

        <SprintActiveCard
          v-for="s in activeSprints"
          :key="s.id"
          :sprint="s"
          :tasks="tasksForSprint(s)"
          :columns="columns"
          :members="members"
          :burndown="s.id === activeSprintForBurndown?.id ? (burndownQuery.data.value ?? null) : null"
          :can-manage="canManage"
          @add-task="addTaskPanel = { sprint: s }"
          @close="onClose(s)"
        />

        <SprintNetworkForecastCard
          v-if="activeSprintForBurndown"
          :workspace-id="wsId"
          :board-id="bId"
          :sprint-id="activeSprintForBurndown.id"
        />
      </section>

      <section v-if="plannedSprints.length > 0" class="space-y-3">
        <div class="flex items-center gap-2.5">
          <h2 class="text-[12px] font-bold uppercase tracking-[0.08em] text-muted m-0">
            Запланированы
          </h2>
          <span class="text-[11px] font-medium text-muted bg-elevated px-1.5 py-0.5 rounded-full">
            {{ plannedSprints.length }}
          </span>
          <span class="flex-1 h-px bg-accented" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SprintCard
            v-for="s in plannedSprints"
            :key="s.id"
            :sprint="s"
            :tasks="tasksForSprint(s)"
            :columns="columns"
            :members="members"
            :can-manage="canManage"
            @add-task="addTaskPanel = { sprint: s }"
            @start="onStart(s)"
            @delete="onDelete(s)"
          />
        </div>
      </section>

      <section v-if="closedSprints.length > 0" class="space-y-3">
        <div class="flex items-center gap-2.5">
          <h2 class="text-[12px] font-bold uppercase tracking-[0.08em] text-muted m-0">
            Закрытые
          </h2>
          <span class="text-[11px] font-medium text-muted bg-elevated px-1.5 py-0.5 rounded-full">
            {{ closedSprints.length }}
          </span>
          <span class="flex-1 h-px bg-accented" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SprintCard
            v-for="s in closedSprints"
            :key="s.id"
            :sprint="s"
            :tasks="tasksForSprint(s)"
            :columns="columns"
            :members="members"
            :can-manage="canManage"
          />
        </div>
      </section>
      </template>
    </div>

    <SprintCreateModal
      v-if="canManage"
      v-model:open="createOpen"
      :workspace-id="wsId"
      :board-id="bId"
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
