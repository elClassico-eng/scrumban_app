<script setup lang="ts">
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

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Календарь` : 'Календарь — Scrumban',
})

// Anchor month: defaults to current, navigable via prev/next.
const anchor = ref(startOfMonth(new Date()))

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// 6-row grid starting Monday — covers any month layout consistently.
const gridDays = computed<Date[]>(() => {
  const first = anchor.value
  // JS getDay: Sun=0..Sat=6; convert to Mon=0..Sun=6 by shifting.
  const shift = (first.getDay() + 6) % 7
  const startTs = first.getTime() - shift * 86_400_000
  return Array.from({ length: 42 }, (_, i) => new Date(startTs + i * 86_400_000))
})

const tasksByDay = computed(() => {
  const map = new Map<string, Task[]>()
  for (const t of tasks.value) {
    if (!t.dueDate) continue
    const key = new Date(t.dueDate).toDateString()
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  return map
})

const monthLabel = computed(() =>
  anchor.value.toLocaleDateString('ru', { month: 'long', year: 'numeric' }),
)

const today = new Date()
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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

const COS_DOT: Record<Task['serviceClass'], string> = {
  expedite: 'bg-red-500',
  fixed_date: 'bg-amber-500',
  standard: 'bg-slate-400',
  intangible: 'bg-zinc-400',
}
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="anchor = addMonths(anchor, -1)"
        />
        <h2 class="text-lg font-semibold capitalize min-w-40 text-center">
          {{ monthLabel }}
        </h2>
        <UButton
          icon="i-lucide-chevron-right"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="anchor = addMonths(anchor, 1)"
        />
        <UButton
          size="sm"
          variant="soft"
          color="neutral"
          class="ml-2"
          @click="anchor = startOfMonth(new Date())"
        >
          Сегодня
        </UButton>
      </div>
      <p class="text-xs text-muted">
        Задачи отображаются по полю «Дедлайн».
      </p>
    </div>

    <div class="flex-1 min-h-0 flex flex-col border border-default rounded-lg overflow-hidden">
      <div class="grid grid-cols-7 bg-elevated border-b border-default">
        <div
          v-for="day in WEEKDAYS"
          :key="day"
          class="px-2 py-2 text-xs uppercase tracking-wide text-muted text-center font-medium"
        >
          {{ day }}
        </div>
      </div>
      <div class="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 divide-x divide-y divide-default">
        <div
          v-for="day in gridDays"
          :key="day.toISOString()"
          class="p-1.5 overflow-y-auto min-h-0 flex flex-col gap-1"
          :class="day.getMonth() !== anchor.getMonth() ? 'bg-elevated/30' : ''"
        >
          <div class="flex items-center justify-between text-xs">
            <span
              :class="[
                sameDate(day, today)
                  ? 'inline-flex items-center justify-center size-5 rounded-full bg-primary text-inverted font-semibold'
                  : day.getMonth() !== anchor.getMonth()
                    ? 'text-muted/60'
                    : 'text-default font-medium',
              ]"
            >
              {{ day.getDate() }}
            </span>
            <span
              v-if="(tasksByDay.get(day.toDateString())?.length ?? 0) > 3"
              class="text-[10px] text-muted"
            >
              +{{ (tasksByDay.get(day.toDateString())!.length) - 3 }}
            </span>
          </div>
          <button
            v-for="task in (tasksByDay.get(day.toDateString()) ?? []).slice(0, 3)"
            :key="task.id"
            type="button"
            class="text-left text-xs px-1.5 py-1 rounded hover:bg-accented/60 transition-colors flex items-center gap-1.5 min-w-0"
            :title="task.title"
            @click="openTask(task.id)"
          >
            <span :class="['size-1.5 rounded-full shrink-0', COS_DOT[task.serviceClass]]" />
            <span class="truncate">{{ task.title }}</span>
          </button>
        </div>
      </div>
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
