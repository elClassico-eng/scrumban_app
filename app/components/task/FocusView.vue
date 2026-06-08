<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { ServiceClass } from '#shared/types/domain'
import type { TasksListResponse } from '#shared/types/task'
import type { FocusTab } from './focus/types'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: tasksList, update, remove, queryKey: tasksKey } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const { list: eventsQuery } = useTaskEventsApi(wsId, bId, tId)
const { list: commentsQuery } = useTaskCommentsApi(wsId, bId, tId)
const { list: checklistQuery } = useTaskChecklistApi(wsId, bId, tId)
const { list: depsQuery } = useTaskDependenciesApi(wsId, bId, tId)
const { list: subtasksQuery } = useTaskSubtasksApi(wsId, bId, tId)
const { list: assigneesQuery, add: addAssignee, remove: removeAssignee } = useTaskAssigneesApi(wsId, bId, tId)
const qc = useQueryClient()
const { defer } = useDeferredAction()

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const canDelete = computed(() => hasRole(workspace.value?.role, 'admin'))

const task = computed(() =>
  tasksList.data.value?.tasks.find(t => t.id === tId.value) ?? null,
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const allTasks = computed(() => tasksList.data.value?.tasks ?? [])
const events = computed(() => eventsQuery.data.value?.events ?? [])
const comments = computed(() => commentsQuery.data.value?.comments ?? [])
const checklistItems = computed(() => checklistQuery.data.value?.items ?? [])
const blockers = computed(() => depsQuery.data.value?.blockers ?? [])
const dependencies = computed(() => depsQuery.data.value?.blocks ?? [])
const subtasks = computed(() => subtasksQuery.data.value?.tasks ?? [])
const assignees = computed(() => assigneesQuery.data.value?.assignees ?? [])
const members = computed(() => membersList.data.value?.members ?? [])

const parentTask = computed(() => {
  if (!task.value?.parentTaskId) return null
  return allTasks.value.find(t => t.id === task.value!.parentTaskId) ?? null
})

const currentColumn = computed(() =>
  columns.value.find(c => c.id === task.value?.columnId) ?? null,
)

const shortId = computed(() => task.value ? task.value.id.slice(0, 8).toUpperCase() : '')

const localDueDate = ref('')

watch(task, (t) => {
  if (!t) return
  localDueDate.value = t.dueDate ? t.dueDate.slice(0, 10) : ''
}, { immediate: true })

const toast = useToast()

async function saveWithFeedback(patch: Record<string, unknown>) {
  if (!task.value) return
  try {
    await update.mutateAsync({ taskId: task.value.id, ...patch })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

watchDebounced(localDueDate, (v) => {
  if (!task.value) return
  const newIso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  if (newIso === task.value.dueDate) return
  saveWithFeedback({ dueDate: newIso })
}, { debounce: 600 })

function saveDeferred(
  patch: Record<string, unknown>,
  toastConfig: { title: string; icon?: string },
  coalesceField: string,
) {
  if (!task.value) return
  const tid = task.value.id
  const prev = qc.getQueryData<TasksListResponse>(tasksKey.value)
  defer({
    coalesceKey: `${coalesceField}:${tid}`,
    toast: toastConfig,
    apply: () => {
      qc.setQueryData<TasksListResponse>(tasksKey.value, (old) => {
        if (!old) return old
        return {
          tasks: old.tasks.map(t => (t.id === tid ? { ...t, ...patch } : t)),
        }
      })
      return prev
    },
    commit: () => update.mutateAsync({ taskId: tid, ...patch }),
    rollback: (snapshot) => {
      if (snapshot) qc.setQueryData(tasksKey.value, snapshot)
      else qc.invalidateQueries({ queryKey: tasksKey.value })
    },
  })
}

function onTitleChange(next: string) {
  if (!task.value || next === task.value.title) return
  saveWithFeedback({ title: next })
}

function onServiceClassChange(v: ServiceClass) {
  if (!task.value || v === task.value.serviceClass) return
  const label = SERVICE_CLASS_INFO[v].shortLabel
  saveDeferred(
    { serviceClass: v },
    { title: `Класс изменён на «${label}»`, icon: 'i-lucide-zap' },
    'serviceClass',
  )
}

async function onAssigneeAdd(userId: string) {
  if (!task.value) return
  const member = membersList.data.value?.members.find(m => m.userId === userId)
  try {
    await addAssignee.mutateAsync({ userId })
    toast.add({
      title: `Назначен ${member ? displayName(member) : 'участник'}`,
      icon: 'i-lucide-user-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось назначить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onAssigneeRemove(userId: string) {
  if (!task.value) return
  try {
    await removeAssignee.mutateAsync(userId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось снять исполнителя'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function onEpicToggle() {
  if (!task.value) return
  saveWithFeedback({ isEpic: !task.value.isEpic })
}

function onStoryPointsChange(value: number | null) {
  if (!task.value || value === task.value.storyPoints) return
  const title = value == null ? 'Оценка снята' : `Оценка: ${value} SP`
  saveDeferred(
    { storyPoints: value },
    { title, icon: 'i-lucide-zap' },
    'storyPoints',
  )
}

const { moveTask } = useTaskMove(wsId, bId)
function onColumnChange(toColumnId: string) {
  if (!task.value || toColumnId === task.value.columnId) return
  moveTask(task.value.id, toColumnId, 0)
}

function onDueDateChange(iso: string) {
  localDueDate.value = iso
}

const confirm = useConfirm()

async function onDelete() {
  if (!task.value) return
  const ok = await confirm({
    title: `Удалить задачу «${task.value.title}»?`,
    description: 'Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  await remove.mutateAsync(task.value.id)
  emit('close')
}

async function onCopyLink() {
  if (!task.value) return
  const url = `${window.location.origin}${pageRoutes.task(wsId.value, bId.value, task.value.id).path}?task=${task.value.id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: 'Ссылка скопирована', icon: 'i-lucide-link', duration: 1500 })
  }
  catch {
    toast.add({ title: 'Не удалось скопировать', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

const isLoading = computed(() => tasksList.isLoading.value && !task.value)
const isMissing = computed(() => !tasksList.isLoading.value && !task.value)

const tab = ref<FocusTab>('desc')

const tabCounts = computed(() => ({
  checks: checklistItems.value.length,
  deps: dependencies.value.length + blockers.value.length,
  comments: comments.value.length,
  activity: events.value.length,
}))
const hasBlocker = computed(() => blockers.value.length > 0 || !!task.value?.blockedReason)

const parentPickerOpen = ref(false)
const parentPickerExcludeIds = computed(() =>
  task.value ? [task.value.id] : [],
)
function onParentPick(taskId: string) {
  if (!task.value) return
  saveWithFeedback({ parentTaskId: taskId })
}
function clearParent() {
  saveWithFeedback({ parentTaskId: null })
}

const subtaskCreateOpen = ref(false)
const subtaskLinkOpen = ref(false)
const backlogColumnId = computed(() => {
  const backlog = columns.value.find(c => c.columnRole === 'backlog')
  return backlog?.id ?? columns.value[0]?.id ?? ''
})

const subtaskLinkExcludeIds = computed(() => {
  const ids = new Set<string>()
  if (task.value) ids.add(task.value.id)
  for (const s of subtasks.value) ids.add(s.id)
  if (task.value?.parentTaskId) ids.add(task.value.parentTaskId)
  return Array.from(ids)
})

async function onLinkExistingSubtask(pickedTaskId: string) {
  await update.mutateAsync({ taskId: pickedTaskId, parentTaskId: task.value?.id ?? null })
}

const router = useRouter()
const route = useRoute()
function openSubtask(taskId: string) {
  router.replace({
    path: route.path,
    query: { ...route.query, task: taskId },
  })
}

const deadlineMeta = computed(() => {
  if (!task.value?.dueDate) return null
  const due = new Date(task.value.dueDate)
  const now = new Date()
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  const overdue = days < 0
  const formatted = due.toLocaleDateString('ru', { day: '2-digit', month: 'short' })
  const weekday = due.toLocaleDateString('ru', { weekday: 'short' })
  let countdown: string
  if (overdue) countdown = `просрочено ${Math.abs(days)} дн.`
  else if (days === 0) countdown = 'сегодня'
  else if (days === 1) countdown = 'завтра'
  else countdown = `через ${days} дн.`
  return { date: `${formatted}, ${weekday}`, countdown, overdue }
})

const watching = ref(true)
function toggleWatch() {
  watching.value = !watching.value
}

onMounted(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})
</script>

<template>
  <div class="grid grid-rows-[44px_1fr] h-[90vh] max-h-[920px] bg-default text-default rounded-2xl overflow-hidden">
    <div v-if="isLoading" class="row-span-2 grid place-items-center p-6">
      <UIcon name="i-lucide-loader" class="animate-spin size-6 text-muted" />
    </div>

    <div v-else-if="isMissing" class="row-span-2 grid place-items-center p-6">
      <div class="text-center space-y-3">
        <UIcon name="i-lucide-alert-circle" class="size-12 text-muted mx-auto" />
        <p class="font-medium">Задача не найдена</p>
        <p class="text-sm text-muted">Возможно, её удалили или у тебя нет доступа.</p>
        <UButton @click="emit('close')">К доске</UButton>
      </div>
    </div>

    <template v-else-if="task">
      <TaskFocusTopBar
        :short-id="shortId"
        :workspace-name="workspace?.name"
        :board-name="board?.name"
        :parent-task="parentTask"
        :can-delete="canDelete"
        :watching="watching"
        @close="emit('close')"
        @toggle-watch="toggleWatch"
        @copy-link="onCopyLink"
        @delete="onDelete"
        @open-parent-picker="parentPickerOpen = true"
      />

      <div class="grid grid-cols-[1fr_340px] min-h-0 overflow-hidden">
        <main class="flex flex-col min-w-0 min-h-0 border-r border-default">
          <TaskFocusHeader
            :task="task"
            :current-column="currentColumn"
            :columns="columns"
            @column-change="onColumnChange"
            @class-change="onServiceClassChange"
            @title-change="onTitleChange"
          />

          <TaskFocusTabs
            v-model:current="tab"
            :counts="tabCounts"
            :has-blocker="hasBlocker"
          />

          <div class="overflow-y-auto px-7 py-[22px] pb-20 min-h-0 flex-1">
            <TaskFocusDescriptionTab
              v-if="tab === 'desc'"
              :description="task.description"
              @save="(v: string) => saveWithFeedback({ description: v })"
            />
            <TaskFocusChecklistTab
              v-else-if="tab === 'checks'"
              :workspace-id="wsId"
              :board-id="bId"
              :task-id="task.id"
            />
            <TaskFocusDepsTab
              v-else-if="tab === 'deps'"
              :workspace-id="wsId"
              :board-id="bId"
              :task-id="task.id"
              :task="task"
              :board-tasks="allTasks"
              :columns="columns"
            />
            <TaskFocusCommentsTab
              v-else-if="tab === 'comments'"
              :workspace-id="wsId"
              :board-id="bId"
              :task-id="task.id"
            />
            <TaskFocusActivityTab
              v-else-if="tab === 'activity'"
              :events="events"
              :workspace-id="wsId"
              :board-id="bId"
            />
          </div>
        </main>

        <TaskFocusSidebar
          :task="task"
          :current-column="currentColumn"
          :columns="columns"
          :assignees="assignees"
          :members="members"
          :parent-task="parentTask"
          :subtasks="subtasks"
          :due-date="localDueDate"
          :deadline-meta="deadlineMeta"
          @column-change="onColumnChange"
          @class-change="onServiceClassChange"
          @assignee-add="onAssigneeAdd"
          @assignee-remove="onAssigneeRemove"
          @epic-toggle="onEpicToggle"
          @due-date-change="onDueDateChange"
          @story-points-change="onStoryPointsChange"
          @open-parent-picker="parentPickerOpen = true"
          @clear-parent="clearParent"
          @open-subtask-create="subtaskCreateOpen = true"
          @open-subtask-link="subtaskLinkOpen = true"
          @open-subtask="openSubtask"
        />
      </div>
    </template>

    <TaskPickerModal
      v-if="task"
      v-model:open="parentPickerOpen"
      :tasks="allTasks"
      :columns="columns"
      :exclude-ids="parentPickerExcludeIds"
      title="Выбрать родительскую задачу"
      placeholder="Найди задачу…"
      @select="onParentPick"
    />

    <TaskPickerModal
      v-if="task"
      v-model:open="subtaskLinkOpen"
      :tasks="allTasks"
      :columns="columns"
      :exclude-ids="subtaskLinkExcludeIds"
      title="Привязать как подзадачу"
      placeholder="Найди задачу…"
      @select="onLinkExistingSubtask"
    />

    <TaskCreateModal
      v-if="task && backlogColumnId"
      v-model:open="subtaskCreateOpen"
      :workspace-id="wsId"
      :board-id="bId"
      :column-id="backlogColumnId"
      :parent-task-id="task.id"
      :parent-title="task.title"
    />
  </div>
</template>