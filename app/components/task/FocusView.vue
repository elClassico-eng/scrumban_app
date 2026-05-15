<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { ServiceClass } from '#shared/types/domain'
import type { TasksListResponse } from '#shared/types/task'
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
const { list: tasksList, update, remove, queryKey: tasksKey } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const { list: eventsQuery } = useTaskEventsApi(wsId, bId, tId)
const qc = useQueryClient()
const { defer } = useDeferredAction()

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
// Match server-side rbac: deleteTask requires admin+ (services/tasks.service.ts).
const canDelete = computed(() => hasRole(workspace.value?.role, 'admin'))

const task = computed(() =>
  tasksList.data.value?.tasks.find(t => t.id === tId.value) ?? null,
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const allTasks = computed(() => tasksList.data.value?.tasks ?? [])
const events = computed(() => eventsQuery.data.value?.events ?? [])

const parentTask = computed(() => {
  if (!task.value?.parentTaskId) return null
  return allTasks.value.find(t => t.id === task.value!.parentTaskId) ?? null
})

const assigneeOptions = computed(() => [
  { label: 'Не назначен', value: null },
  ...(membersList.data.value?.members ?? []).map(m => ({
    label: displayName(m),
    value: m.userId,
  })),
])

const localTitle = ref('')
const localDescription = ref('')
const localDueDate = ref('')
const localBlockedReason = ref('')

watch(task, (t) => {
  if (!t) return
  localTitle.value = t.title
  localDescription.value = t.description
  localDueDate.value = t.dueDate ? t.dueDate.slice(0, 10) : ''
  localBlockedReason.value = t.blockedReason ?? ''
}, { immediate: true })

const toast = useToast()

async function saveWithFeedback(patch: Record<string, unknown>) {
  if (!task.value) return
  try {
    await update.mutateAsync({ taskId: task.value.id, ...patch })
    toast.add({
      title: 'Сохранено',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

watchDebounced(localTitle, (v) => {
  if (!task.value || v === task.value.title || v.trim().length === 0) return
  saveWithFeedback({ title: v })
}, { debounce: 500 })

watchDebounced(localDescription, (v) => {
  if (!task.value || v === task.value.description) return
  saveWithFeedback({ description: v })
}, { debounce: 500 })

watchDebounced(localDueDate, (v) => {
  if (!task.value) return
  const newIso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  if (newIso === task.value.dueDate) return
  saveWithFeedback({ dueDate: newIso })
}, { debounce: 500 })

watchDebounced(localBlockedReason, (v) => {
  if (!task.value) return
  const next = v.trim() === '' ? null : v.trim()
  if (next === task.value.blockedReason) return
  saveWithFeedback({ blockedReason: next })
}, { debounce: 500 })

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

function onServiceClassChange(v: ServiceClass) {
  if (!task.value || v === task.value.serviceClass) return
  const label = SERVICE_CLASS_INFO[v].label
  saveDeferred(
    { serviceClass: v },
    { title: `Класс изменён на «${label}»`, icon: 'i-lucide-zap' },
    'serviceClass',
  )
}
function onAssigneeChange(v: string | null) {
  if (!task.value || v === task.value.assigneeId) return
  const member = membersList.data.value?.members.find(m => m.userId === v)
  const title = v == null
    ? 'Снят исполнитель'
    : `Назначен ${member ? displayName(member) : 'участник'}`
  saveDeferred(
    { assigneeId: v },
    { title, icon: 'i-lucide-user-check' },
    'assignee',
  )
}
function onParentChange(v: string | null) {
  if (!task.value || v === task.value.parentTaskId) return
  saveWithFeedback({ parentTaskId: v })
}
function onEpicToggle(v: boolean | 'indeterminate') {
  const next = v === true
  if (!task.value || next === task.value.isEpic) return
  saveWithFeedback({ isEpic: next })
}

const { moveTask } = useTaskMove(wsId, bId)
function onColumnChange(toColumnId: string) {
  if (!task.value || toColumnId === task.value.columnId) return
  moveTask(task.value.id, toColumnId, 0)
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

const isLoading = computed(() => tasksList.isLoading.value && !task.value)
const isMissing = computed(() => !tasksList.isLoading.value && !task.value)

const parentPickerOpen = ref(false)
const parentPickerExcludeIds = computed(() =>
  task.value ? [task.value.id] : [],
)
function onParentPick(taskId: string) {
  onParentChange(taskId)
}
function clearParent() {
  onParentChange(null)
}
</script>

<template>
  <div class="flex flex-col h-[90vh] bg-default">
    <header class="flex items-center justify-between gap-4 px-8 py-3 border-b border-default shrink-0">
      <span class="text-xs text-muted uppercase tracking-wide">Задача</span>
      <div class="flex items-center gap-1">
        <UButton
          v-if="task && canDelete"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          :loading="remove.isPending.value"
          @click="onDelete"
        >
          Удалить
        </UButton>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emit('close')"
        />
      </div>
    </header>

    <div v-if="isLoading" class="text-center py-12 text-muted flex-1">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="isMissing" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-3 px-6">
        <UIcon name="i-lucide-alert-circle" class="size-12 text-muted mx-auto" />
        <p class="font-medium">Задача не найдена</p>
        <p class="text-sm text-muted">Возможно, её удалили или у тебя нет доступа.</p>
        <UButton @click="emit('close')">К доске</UButton>
      </div>
    </div>

    <div
      v-else-if="task"
      class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] overflow-hidden"
    >
      <main class="overflow-y-auto px-10 py-8 space-y-8 min-w-0">
        <input
          v-model="localTitle"
          class="w-full text-3xl font-bold bg-transparent outline-none border-b border-transparent focus:border-default pb-2 -mx-1 px-1"
          placeholder="Название задачи"
        >

        <section class="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-columns-3" class="size-4" />
              Колонка
            </span>
            <USelect
              :model-value="task.columnId"
              :items="columns.map(c => ({ label: c.name, value: c.id }))"
              variant="ghost"
              class="w-full"
              @update:model-value="onColumnChange"
            />
          </div>
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-user" class="size-4" />
              Исполнитель
            </span>
            <USelect
              :model-value="task.assigneeId"
              :items="assigneeOptions"
              variant="ghost"
              class="w-full"
              @update:model-value="onAssigneeChange"
            />
          </div>
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-calendar" class="size-4" />
              Дедлайн
            </span>
            <UInput v-model="localDueDate" type="date" variant="ghost" class="w-full" />
          </div>
          <div class="grid grid-cols-[140px_1fr] items-start gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted pt-1.5">
              <UIcon name="i-lucide-zap" class="size-4" />
              Класс
            </span>
            <div class="space-y-1">
              <USelect
                :model-value="task.serviceClass"
                :items="SERVICE_CLASS_OPTIONS"
                variant="ghost"
                class="w-full"
                @update:model-value="onServiceClassChange"
              />
              <p class="text-xs text-muted px-2">
                {{ SERVICE_CLASS_INFO[task.serviceClass].hint }}
              </p>
            </div>
          </div>
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-corner-up-left" class="size-4" />
              Родитель
            </span>
            <div class="flex items-center gap-2 min-w-0">
              <button
                type="button"
                class="flex-1 text-left text-sm px-3 py-1.5 rounded hover:bg-elevated transition-colors truncate"
                :class="parentTask ? '' : 'text-muted'"
                @click="parentPickerOpen = true"
              >
                {{ parentTask ? parentTask.title : 'Выбрать родителя...' }}
              </button>
              <UButton
                v-if="parentTask"
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                title="Открепить от родителя"
                @click="clearParent"
              />
            </div>
          </div>
          <div class="grid grid-cols-[140px_1fr] items-center gap-3 py-2 px-2 rounded hover:bg-elevated/50 transition-colors">
            <span class="flex items-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-flag" class="size-4" />
              Эпик
            </span>
            <UCheckbox
              :model-value="task.isEpic"
              @update:model-value="onEpicToggle"
            />
          </div>
        </section>

        <section class="space-y-2 pt-6 border-t border-default">
          <h3 class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-align-left" class="size-3.5" />
            Описание
          </h3>
          <UTextarea
            v-model="localDescription"
            :rows="5"
            class="w-full"
            placeholder="Добавь описание..."
          />
        </section>

        <section class="space-y-3 pt-6 border-t border-default">
          <TaskChecklistSection
            :workspace-id="wsId"
            :board-id="bId"
            :task-id="task.id"
          />
        </section>

        <section class="space-y-3 pt-6 border-t border-default">
          <TaskDependenciesSection
            :workspace-id="wsId"
            :board-id="bId"
            :task-id="task.id"
            :board-tasks="allTasks"
            :columns="columns"
          />
        </section>

        <section class="space-y-2 pt-6 border-t border-default">
          <h3 class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-lock" class="size-3.5" />
            Причина блокировки
          </h3>
          <UTextarea
            v-model="localBlockedReason"
            :rows="2"
            class="w-full"
            placeholder="Почему задача заблокирована"
          />
        </section>

        <section class="space-y-3 pt-6 border-t border-default">
          <TaskCommentsSection
            :workspace-id="wsId"
            :board-id="bId"
            :task-id="task.id"
          />
        </section>
      </main>

      <aside class="border-l border-default bg-elevated/30 overflow-y-auto px-6 py-6 space-y-4">
        <h3 class="text-xs uppercase tracking-wide text-muted">История</h3>
        <TaskEventTimeline :events="events" :workspace-id="wsId" />
        <p class="text-xs text-muted pt-2">
          Создана {{ formatRelativeDate(task.createdAt) }}
        </p>
        <NuxtLink
          v-if="parentTask"
          :to="pageRoutes.task(wsId, bId, parentTask.id)"
          class="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <UIcon name="i-lucide-corner-up-left" class="size-3.5" />
          Открыть родителя
        </NuxtLink>
      </aside>
    </div>

    <TaskPickerModal
      v-if="task"
      v-model:open="parentPickerOpen"
      :tasks="allTasks"
      :columns="columns"
      :exclude-ids="parentPickerExcludeIds"
      title="Выбрать родительскую задачу"
      placeholder="Найди задачу..."
      @select="onParentPick"
    />
  </div>
</template>