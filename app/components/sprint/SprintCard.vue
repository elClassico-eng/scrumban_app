<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'

const props = defineProps<{
  sprint: Sprint
  workspaceId: string
  boardId: string
  canManage: boolean
  // Task / column context is passed in so the card can resolve sprint
  // membership against the same data the kanban view uses (single source
  // of truth: tasksList query).
  allTasks: Task[]
  columns: BoardColumn[]
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const sId = computed(() => props.sprint.id)
const { start, close, remove } = useSprintsApi(wsId, bId)
const { list: sprintTasksQuery, add: addTask, remove: removeTask } = useSprintTasksApi(wsId, bId, sId)
const toast = useToast()

const actionError = ref<string | null>(null)

const sprintTaskIds = computed(() => new Set(sprintTasksQuery.data.value?.items.map(i => i.taskId) ?? []))
const sprintTasks = computed(() =>
  props.allTasks.filter(t => sprintTaskIds.value.has(t.id)),
)
const doneColumnIds = computed(() => {
  const s = new Set<string>()
  for (const c of props.columns) {
    if (c.columnRole === 'done' || c.columnRole === 'archived') s.add(c.id)
  }
  return s
})
const progress = computed(() => {
  const total = sprintTasks.value.length
  if (total === 0) return null
  const done = sprintTasks.value.filter(t => doneColumnIds.value.has(t.columnId)).length
  return { done, total, percent: Math.round((done / total) * 100) }
})

const expanded = ref(false)
const pickerOpen = ref(false)

async function onAddTasks(taskIds: string[]) {
  try {
    await Promise.all(taskIds.map(id => addTask.mutateAsync({ taskId: id })))
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить задачи в спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onRemoveTask(taskId: string) {
  try {
    await removeTask.mutateAsync(taskId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось убрать задачу из спринта'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const router = useRouter()
const route = useRoute()
function openTaskModal(taskId: string) {
  router.push({ path: route.path, query: { ...route.query, task: taskId } })
}

async function onStart() {
  actionError.value = null
  try {
    await start.mutateAsync(props.sprint.id)
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось запустить спринт')
  }
}

const confirm = useConfirm()

async function onClose() {
  actionError.value = null
  const ok = await confirm({
    title: `Закрыть спринт «${props.sprint.name}»?`,
    description: 'Закрытый спринт больше нельзя запустить.',
    confirmLabel: 'Закрыть спринт',
  })
  if (!ok) return
  try {
    await close.mutateAsync(props.sprint.id)
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось закрыть спринт')
  }
}

async function onRemove() {
  actionError.value = null
  const ok = await confirm({
    title: `Удалить спринт «${props.sprint.name}»?`,
    description: 'Только planned-спринты можно удалять. Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(props.sprint.id)
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось удалить спринт')
  }
}

function formatDateRange(): string | null {
  const s = props.sprint.plannedStartAt
  const e = props.sprint.plannedEndAt
  if (!s && !e) return null
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
  if (s && e) return `${fmt(s)} → ${fmt(e)}`
  if (s) return `с ${fmt(s)}`
  if (e) return `до ${fmt(e!)}`
  return null
}
</script>

<template>
  <UCard>
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold truncate">{{ sprint.name }}</h3>
          <p v-if="sprint.goal" class="text-sm text-muted mt-1 line-clamp-2">{{ sprint.goal }}</p>
        </div>
        <SprintStateBadge :state="sprint.state" />
      </div>
      <div class="flex items-center gap-3 text-xs text-muted">
        <span v-if="formatDateRange()" class="flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-3.5" />
          {{ formatDateRange() }}
        </span>
        <span v-if="sprint.startedAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-play" class="size-3.5" />
          Стартовал {{ new Date(sprint.startedAt).toLocaleDateString('ru') }}
        </span>
        <span v-if="sprint.endedAt" class="flex items-center gap-1">
          <UIcon name="i-lucide-check" class="size-3.5" />
          Закрыт {{ new Date(sprint.endedAt).toLocaleDateString('ru') }}
        </span>
      </div>
      <UAlert
        v-if="actionError"
        color="error"
        variant="soft"
        :title="actionError"
        icon="i-lucide-alert-circle"
        :close="{ onClick: () => { actionError = null } }"
      />

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            @click="expanded = !expanded"
          >
            <UIcon
              :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4"
            />
            <span>Задачи</span>
            <span v-if="progress" class="text-xs text-muted font-normal">
              {{ progress.done }} / {{ progress.total }} готово
            </span>
            <span v-else class="text-xs text-muted font-normal">пусто</span>
          </button>
          <UButton
            v-if="canManage && sprint.state !== 'closed'"
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="pickerOpen = true"
          >
            Добавить
          </UButton>
        </div>

        <div v-if="progress" class="h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            class="h-full bg-success transition-all"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>

        <div v-if="expanded" class="space-y-1 pl-6">
          <div
            v-for="task in sprintTasks"
            :key="task.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-elevated/60 group"
          >
            <UIcon
              :name="doneColumnIds.has(task.columnId) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
              :class="['size-3.5 shrink-0', doneColumnIds.has(task.columnId) ? 'text-success' : 'text-muted']"
            />
            <button
              type="button"
              class="text-sm flex-1 text-left truncate hover:text-primary"
              :class="doneColumnIds.has(task.columnId) ? 'line-through text-muted' : ''"
              @click="openTaskModal(task.id)"
            >
              {{ task.title }}
            </button>
            <UButton
              v-if="canManage && sprint.state !== 'closed'"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Убрать из спринта"
              @click="onRemoveTask(task.id)"
            />
          </div>
          <p v-if="sprintTasks.length === 0" class="text-xs text-muted px-2 py-1.5">
            В спринте пока нет задач.
          </p>
        </div>
      </div>

      <div v-if="canManage && sprint.state !== 'closed'" class="flex gap-2 pt-1">
        <UButton
          v-if="sprint.state === 'planned'"
          icon="i-lucide-play"
          size="sm"
          :loading="start.isPending.value"
          @click="onStart"
        >
          Запустить
        </UButton>
        <UButton
          v-if="sprint.state === 'active' || sprint.state === 'planned'"
          icon="i-lucide-check"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="close.isPending.value"
          @click="onClose"
        >
          Закрыть
        </UButton>
        <UButton
          v-if="sprint.state === 'planned'"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="remove.isPending.value"
          class="ml-auto"
          @click="onRemove"
        />
      </div>
    </div>

    <TaskPickerModal
      v-if="canManage"
      v-model:open="pickerOpen"
      :tasks="allTasks"
      :columns="columns"
      :exclude-ids="Array.from(sprintTaskIds)"
      title="Добавить задачи в спринт"
      placeholder="Найди задачи..."
      multiple
      @select-many="onAddTasks"
    />
  </UCard>
</template>