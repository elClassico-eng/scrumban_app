<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { TaskPriority } from '#shared/types/domain'

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
const { list: eventsQuery } = useTaskEventsApi(wsId, bId, taskIdRef)

const task = computed(() =>
  tasksList.data.value?.tasks.find(t => t.id === boardStore.openTaskId) ?? null,
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const events = computed(() => eventsQuery.data.value?.events ?? [])

const PRIORITY_OPTIONS: Array<{ label: string; value: TaskPriority }> = [
  { label: 'Низкий', value: 'low' },
  { label: 'Средний', value: 'medium' },
  { label: 'Высокий', value: 'high' },
]

// Local refs for debounced inline edit. They sync from the canonical task
// whenever it changes (drawer reopen, or remote SSE update mutates cache).
const localTitle = ref('')
const localDescription = ref('')
const localPriority = ref<TaskPriority>('medium')

watch(task, (t) => {
  if (!t) return
  localTitle.value = t.title
  localDescription.value = t.description
  localPriority.value = t.priority
}, { immediate: true })

// Debounced auto-save for text fields. 500ms is the typical "user finished
// typing" pause; tighter feels jittery, looser feels unresponsive.
watchDebounced(localTitle, (v) => {
  if (!task.value || v === task.value.title || v.trim().length === 0) return
  update.mutate({ taskId: task.value.id, title: v })
}, { debounce: 500 })

watchDebounced(localDescription, (v) => {
  if (!task.value || v === task.value.description) return
  update.mutate({ taskId: task.value.id, description: v })
}, { debounce: 500 })

// Priority changes via select — instant, no debounce.
function onPriorityChange(v: TaskPriority) {
  if (!task.value || v === task.value.priority) return
  localPriority.value = v
  update.mutate({ taskId: task.value.id, priority: v })
}

const { moveTask } = useTaskMove(wsId, bId)
function onColumnChange(toColumnId: string) {
  if (!task.value || toColumnId === task.value.columnId) return
  // Position 0 = top of new column. Server renumbers the rest.
  moveTask(task.value.id, toColumnId, 0)
}

async function onDelete() {
  if (!task.value) return
  if (!confirm(`Удалить задачу «${task.value.title}»?`)) return
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
              <p class="text-xs text-muted uppercase tracking-wide mb-1.5">Приоритет</p>
              <USelect
                :model-value="localPriority"
                :items="PRIORITY_OPTIONS"
                class="w-full"
                @update:model-value="onPriorityChange"
              />
            </div>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide mb-1.5">История</p>
            <TaskEventTimeline :events="events" />
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