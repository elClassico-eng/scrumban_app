<script setup lang="ts">
import { addDays, type GanttRow, type GanttZoom } from '~/utils/gantt'
import type { ServiceClass } from '#shared/types/domain'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

useBoardSse(wsId, bId)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: tasksList } = useTasksApi(wsId, bId)
const { list: sprintsList } = useSprintsApi(wsId, bId)

const activeSprint = computed(() => sprintsList.data.value?.sprints.find(s => s.state === 'active') ?? null)
const activeSprintId = computed(() => activeSprint.value?.id ?? '')
const { report } = useSprintNetworkApi(wsId, bId, activeSprintId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Timeline` : 'Timeline — Такт',
})

const now = new Date()
const zoom = ref<GanttZoom>('week')
const mode = ref<'cpm' | 'fact'>('cpm')

const cpmAvailable = computed(() => report.data.value?.ok === true)
const effectiveMode = computed<'cpm' | 'fact'>(() => cpmAvailable.value ? mode.value : 'fact')

const anchor = computed(() =>
  new Date(activeSprint.value?.startedAt ?? activeSprint.value?.plannedStartAt ?? now.getTime()),
)

const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const serviceClassById = computed(() => {
  const out: Record<string, ServiceClass> = {}
  for (const t of tasks.value) out[t.id] = t.serviceClass
  return out
})

const horizonDays = computed(() => {
  const r = report.data.value
  return r?.ok ? r.horizonDays : null
})

const rows = computed<GanttRow[]>(() => {
  const r = report.data.value
  if (effectiveMode.value === 'cpm' && r?.ok) {
    return buildCpmRows(r.tasks, anchor.value, serviceClassById.value)
  }
  return buildFactRows(tasks.value, now)
})

const range = computed(() => {
  const extra: Date[] = [now]
  if (horizonDays.value != null) extra.push(addDays(anchor.value, horizonDays.value))
  return rowsRange(rows.value, extra)
})

const summary = computed(() => {
  const r = report.data.value
  return r?.ok
    ? { p50: Math.round(r.simulation.p50Days), p85: Math.round(r.simulation.p85Days), prob: r.simulation.probabilityWithinHorizon }
    : null
})

const sprintName = computed(() => activeSprint.value?.name ?? null)

const insufficient = computed(() => {
  const r = report.data.value
  return r && !r.ok ? { missing: Math.max(0, r.requiredSamples - r.closedSamples) } : null
})

const hasActiveSprint = computed(() => activeSprint.value !== null)
const isEmpty = computed(() => rows.value.length === 0)

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

    <div
      v-if="!hasActiveSprint"
      class="flex-1 flex flex-col items-center justify-center text-center gap-2 border border-default rounded-lg"
    >
      <UIcon name="i-lucide-calendar-clock" class="size-10 text-dimmed" />
      <p class="font-medium">Нет активного спринта</p>
      <p class="text-sm text-muted">Запусти спринт, чтобы увидеть сетевой план.</p>
    </div>

    <template v-else>
      <GanttToolbar
        :zoom="zoom"
        :mode="effectiveMode"
        :cpm-available="cpmAvailable"
        :sprint-name="sprintName"
        :summary="summary"
        @update:zoom="zoom = $event"
        @update:mode="mode = $event"
      />

      <div
        v-if="insufficient"
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated text-sm text-muted"
      >
        <UIcon name="i-lucide-info" class="size-4 shrink-0" />
        Для сетевого плана нужно ещё {{ insufficient.missing }} закрытых задач — пока показан факт.
      </div>

      <div v-if="!isEmpty" class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm bg-accent-500" />критический путь</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm bg-slate-400" />задача</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-1 w-4 rounded-full bg-slate-400/40" />резерв</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-3 w-0.5 bg-sky-500" />сегодня</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-3 border-l-2 border-dashed border-red-400" />горизонт спринта</span>
        <span class="inline-flex items-center gap-1.5"><UIcon name="i-lucide-move-right" class="size-3.5" />зависимость</span>
      </div>

      <div
        v-if="isEmpty"
        class="flex-1 flex flex-col items-center justify-center text-center gap-2 border border-default rounded-lg"
      >
        <UIcon name="i-lucide-bar-chart-horizontal" class="size-10 text-dimmed" />
        <p class="text-sm text-muted">Нет задач для отображения.</p>
      </div>
      <GanttChart
        v-else
        :rows="rows"
        :range="range"
        :zoom="zoom"
        :now="now"
        :anchor="anchor"
        :horizon-days="horizonDays"
        class="min-h-0"
        @open-task="openTask"
      />
    </template>

    <TaskFocusModal
      v-model:open="taskModalOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :task-id="openTaskId"
    />
  </div>
</template>
