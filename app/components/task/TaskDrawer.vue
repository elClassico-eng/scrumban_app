<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ServiceClass } from '#shared/types/domain'

const props = defineProps<{ workspaceId: string; boardId: string }>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const boardStore = useBoardStore()

const open = computed({
  get: () => boardStore.openTaskId !== null,
  set: (v) => { if (!v) boardStore.closeTask() },
})

const taskIdRef = computed(() => boardStore.openTaskId)

const { list: tasksList, update, remove } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)
const { list: eventsQuery } = useTaskEventsApi(wsId, bId, taskIdRef)

const task = computed(() =>
  tasksList.data.value?.tasks.find(t => t.id === boardStore.openTaskId) ?? null,
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const events = computed(() => eventsQuery.data.value?.events ?? [])

const assigneeOptions = computed(() => [
  { label: 'Не назначен', value: null },
  ...(membersList.data.value?.members ?? []).map(m => ({
    label: m.email,
    value: m.userId,
  })),
])


// Local refs for debounced inline edit. They sync from the canonical task
// whenever it changes (drawer reopen, or remote SSE update mutates cache).
const localTitle = ref('')
const localDescription = ref('')
// dueDate as YYYY-MM-DD for <input type="date">. Convert to ISO on save.
const localDueDate = ref('')

watch(task, (t) => {
  if (!t) return
  localTitle.value = t.title
  localDescription.value = t.description
  localDueDate.value = t.dueDate ? t.dueDate.slice(0, 10) : ''
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
  catch {
    toast.add({
      title: 'Не удалось сохранить',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

// Debounced auto-save for text fields. 500ms is the typical "user finished
// typing" pause; tighter feels jittery, looser feels unresponsive.
watchDebounced(localTitle, (v) => {
  if (!task.value || v === task.value.title || v.trim().length === 0) return
  saveWithFeedback({ title: v })
}, { debounce: 500 })

watchDebounced(localDescription, (v) => {
  if (!task.value || v === task.value.description) return
  saveWithFeedback({ description: v })
}, { debounce: 500 })

function onServiceClassChange(v: ServiceClass) {
  if (!task.value || v === task.value.serviceClass) return
  saveWithFeedback({ serviceClass: v })
}

watchDebounced(localDueDate, (v) => {
  if (!task.value) return
  const newIso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  if (newIso === task.value.dueDate) return
  saveWithFeedback({ dueDate: newIso })
}, { debounce: 500 })

function onAssigneeChange(v: string | null) {
  if (!task.value || v === task.value.assigneeId) return
  saveWithFeedback({ assigneeId: v })
}

const { moveTask } = useTaskMove(wsId, bId)
function onColumnChange(toColumnId: string) {
  if (!task.value || toColumnId === task.value.columnId) return
  // Position 0 = top of new column. Server renumbers the rest.
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
  boardStore.closeTask()
}
</script>

<template>
  <USlideover v-model:open="open" side="right" :ui="{ content: 'max-w-lg' }">
    <template #content>
      <div v-if="task" class="flex flex-col h-full">
        <div class="flex items-start justify-between gap-3 p-6 border-b border-default">
          <UInput
            v-model="localTitle"
            variant="none"
            size="xl"
            class="flex-1 font-semibold"
            :ui="{ base: 'text-lg px-0' }"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="boardStore.closeTask()"
          />
        </div>
        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Описание</p>
            <UTextarea
              v-model="localDescription"
              :rows="5"
              class="w-full"
              placeholder="Добавь описание..."
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Колонка</p>
              <USelect
                :model-value="task.columnId"
                :items="columns.map(c => ({ label: c.name, value: c.id }))"
                class="w-full"
                @update:model-value="onColumnChange"
              />
            </div>
            <div>
              <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Класс обслуживания</p>
              <USelect
                :model-value="task.serviceClass"
                :items="SERVICE_CLASS_OPTIONS"
                class="w-full"
                @update:model-value="onServiceClassChange"
              />
              <p class="text-xs text-muted mt-1.5">
                {{ SERVICE_CLASS_INFO[task.serviceClass].hint }}
              </p>
            </div>
            <div v-if="task.serviceClass === 'fixed_date'" class="col-span-2">
              <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Дедлайн</p>
              <UInput v-model="localDueDate" type="date" class="w-full" />
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Исполнитель</p>
              <USelect
                :model-value="task.assigneeId"
                :items="assigneeOptions"
                class="w-full"
                @update:model-value="onAssigneeChange"
              />
            </div>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1.5">История</p>
            <TaskEventTimeline :events="events" :workspace-id="wsId" />
          </div>
        </div>
        <div class="p-6 border-t border-default flex justify-between items-center">
          <span class="text-xs text-muted">
            Создана {{ formatRelativeDate(task.createdAt) }}
          </span>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            size="sm"
            :loading="remove.isPending.value"
            @click="onDelete"
          >
            Удалить
          </UButton>
        </div>
      </div>
    </template>
  </USlideover>
</template>