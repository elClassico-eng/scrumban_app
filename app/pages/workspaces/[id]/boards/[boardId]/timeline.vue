<script setup lang="ts">
import VChart from 'vue-echarts'
import type { Task } from '#shared/types/task'

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

const activeSprintId = computed(() =>
  sprintsList.data.value?.sprints.find(s => s.state === 'active')?.id ?? '',
)
const { report: networkReport } = useSprintNetworkApi(wsId, bId, activeSprintId)

const criticalIds = computed(() => {
  const r = networkReport.data.value
  return new Set(r?.ok ? r.criticalPathIds : [])
})
const slackById = computed(() => {
  const r = networkReport.data.value
  const map = new Map<string, number>()
  if (r?.ok) {
    for (const t of r.tasks) map.set(t.taskId, t.slackDays)
  }
  return map
})

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Timeline` : 'Timeline — Scrumban',
})

// CoS palette mirrors what cards show, so the same colour cue carries across views.
const COS_COLOR: Record<Task['serviceClass'], string> = {
  expedite: '#ef4444', // red-500
  fixed_date: '#f59e0b', // amber-500
  standard: '#94a3b8', // slate-400
  intangible: '#a1a1aa', // zinc-400
}

const orderedTasks = computed(() =>
  [...(tasksList.data.value?.tasks ?? [])]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
)

const colorMode = useColorMode()
const theme = computed(() => colorMode.value === 'dark' ? 'dark' : undefined)

const option = computed(() => {
  const list = orderedTasks.value
  if (list.length === 0) return {}
  const now = Date.now()
  const data = list.map((t, idx) => {
    const start = new Date(t.createdAt).getTime()
    const end = t.closedAt ? new Date(t.closedAt).getTime() : now
    return {
      name: t.title,
      value: [idx, start, end, t.id, !!t.closedAt, criticalIds.value.has(t.id) ? 1 : 0],
      itemStyle: { color: COS_COLOR[t.serviceClass] },
    }
  })
  const categories = list.map((_, i) => i)

  return {
    tooltip: {
      formatter: (p: { data: { name: string; value: [number, number, number, string, boolean, number] } }) => {
        const [, start, end, taskId, closed] = p.data.value
        const days = (end - start) / 86_400_000
        const status = closed ? 'закрыта' : 'в работе'
        const slack = slackById.value.get(taskId)
        const slackLine = slack === undefined
          ? ''
          : `<br/>${criticalIds.value.has(taskId) ? 'критический путь спринта' : `резерв: ${slack} дн`}`
        return `${p.data.name}<br/>${new Date(start).toLocaleDateString('ru')} → ${new Date(end).toLocaleDateString('ru')}<br/>${days.toFixed(1)} дн (${status})${slackLine}`
      },
    },
    grid: { top: 16, left: 32, right: 24, bottom: 50 },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: { show: false },
      axisTick: { show: false },
      inverse: true,
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 18, bottom: 12 },
    ],
    series: [{
      type: 'custom',
      // Render each task as a horizontal bar from createdAt to closedAt/now.
      // Open tasks get a translucent fill so they read differently from closed ones.
      renderItem: (
        params: { context: Record<string, unknown> },
        api: {
          value: (idx: number) => number
          coord: (pt: [number, number]) => [number, number]
          size: (data: [number, number]) => [number, number]
          style: () => Record<string, unknown>
        },
      ) => {
        const yIdx = api.value(0)
        const start = api.value(1)
        const end = api.value(2)
        const closed = api.value(4)
        const critical = api.value(5) === 1
        const [x0, y0] = api.coord([start, yIdx])
        const [x1] = api.coord([end, yIdx])
        const [, h] = api.size([0, 1])
        const barHeight = Math.max(8, h * 0.55)
        const baseStyle = api.style()
        return {
          type: 'rect',
          shape: { x: x0, y: y0 - barHeight / 2, width: Math.max(2, x1 - x0), height: barHeight },
          style: {
            ...baseStyle,
            opacity: closed ? 1 : 0.45,
            stroke: critical ? '#E85002' : (closed ? 'transparent' : (baseStyle.fill as string)),
            lineWidth: critical ? 2.5 : (closed ? 0 : 1.5),
          },
        }
      },
      encode: { x: [1, 2], y: 0 },
      data,
    }],
  }
})

// ECharts click events come with `data: OptionDataItem`; narrow to our shape.
function onChartClick(e: { data?: unknown }) {
  const data = e.data as { value?: [number, number, number, string, boolean, number] } | null
  const taskId = data?.value?.[3]
  if (taskId) {
    router.push({ path: route.path, query: { ...route.query, task: taskId } })
  }
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

const isEmpty = computed(() => orderedTasks.value.length === 0)
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-muted">
        Каждая полоса — задача от создания до закрытия. Прозрачные — ещё в работе.
      </p>
      <div class="flex items-center gap-3 text-xs">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded bg-red-500" />{{ SERVICE_CLASS_INFO.expedite.shortLabel }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded bg-amber-500" />{{ SERVICE_CLASS_INFO.fixed_date.shortLabel }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded bg-slate-400" />{{ SERVICE_CLASS_INFO.standard.shortLabel }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded bg-zinc-400" />{{ SERVICE_CLASS_INFO.intangible.shortLabel }}
        </span>
        <span v-if="criticalIds.size > 0" class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded border-2 border-accent-500" />Критический путь
        </span>
      </div>
    </div>

    <div class="flex-1 min-h-0 border border-default rounded-lg p-2">
      <UCard v-if="isEmpty" class="text-center py-12">
        <div class="space-y-2">
          <UIcon name="i-lucide-bar-chart-horizontal" class="size-12 text-muted mx-auto" />
          <p class="font-medium">Нет задач для timeline</p>
          <p class="text-sm text-muted">Создай задачу на доске — она появится здесь.</p>
        </div>
      </UCard>
      <VChart
        v-else
        :option="option"
        :theme="theme"
        autoresize
        class="w-full h-full"
        @click="onChartClick"
      />
    </div>

    <UModal
      v-model:open="taskModalOpen"
      :ui="{
        content: 'w-[95vw] max-w-[1600px] p-0',
        overlay: 'bg-black/70',
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
  </div>
</template>
