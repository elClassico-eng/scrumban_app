<script setup lang="ts">
import draggable from 'vuedraggable'
import type { BoardColumn as Column } from '#shared/types/column'
import type { Task } from '#shared/types/task'

const props = defineProps<{
  column: Column
  tasks: Task[]
  workspaceId: string
  boardId: string
  canCreate: boolean // member+: create tasks
  canManage: boolean // admin+: delete/edit column
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { moveTask } = useTaskMove(wsId, bId)
const { remove: removeColumn } = useColumnsApi(wsId, bId)
const confirm = useConfirm()
const toast = useToast()

const localTasks = ref<Task[]>([])
watch(() => props.tasks, (next) => {
  localTasks.value = [...next]
}, { immediate: true })

interface ChangeEvent {
  added?: { newIndex: number; element: Task }
  removed?: { oldIndex: number; element: Task }
  moved?: { oldIndex: number; newIndex: number; element: Task }
}

function onChange(evt: ChangeEvent) {
  // `removed` from the source column is paired with `added` on the
  // destination column — we only fire the move from the destination side
  // so the API gets exactly one call per drag.
  if (evt.added) {
    moveTask(evt.added.element.id, props.column.id, evt.added.newIndex)
  }
  else if (evt.moved) {
    moveTask(evt.moved.element.id, props.column.id, evt.moved.newIndex)
  }
}

const createOpen = ref(false)

const wipState = computed(() => {
  if (props.column.wipLimit == null) return null
  const count = localTasks.value.length
  return {
    limit: props.column.wipLimit,
    count,
    over: count > props.column.wipLimit,
  }
})

async function onDeleteColumn() {
  const ok = await confirm({
    title: `Удалить колонку «${props.column.name}»?`,
    description: 'Если в колонке есть задачи, удаление будет отменено — сначала перенеси их.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await removeColumn.mutateAsync(props.column.id)
  }
  catch (err) {
    const e = err as { statusCode?: number }
    if (e?.statusCode === 422) {
      toast.add({
        title: 'В колонке есть задачи',
        description: 'Сначала перенеси их в другие колонки или удали.',
        color: 'warning',
        icon: 'i-lucide-alert-circle',
      })
    }
    else {
      toast.add({
        title: 'Не удалось удалить колонку',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }
}

const menuItems = computed(() => [[
  {
    label: 'Удалить колонку',
    icon: 'i-lucide-trash-2',
    onSelect: onDeleteColumn,
  },
]])
</script>

<template>
  <div class="w-72 shrink-0 bg-elevated rounded-lg flex flex-col max-h-full">
    <div class="px-3 py-2.5 border-b border-default flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <h3 class="font-medium text-sm truncate">{{ column.name }}</h3>
        <span class="text-xs text-muted">{{ localTasks.length }}</span>
        <UBadge
          v-if="wipState"
          :color="wipState.over ? 'error' : 'neutral'"
          variant="subtle"
          size="xs"
        >
          WIP {{ wipState.count }}/{{ wipState.limit }}
        </UBadge>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          v-if="canCreate"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="createOpen = true"
        />
        <UDropdownMenu v-if="canManage" :items="menuItems">
          <UButton
            icon="i-lucide-more-horizontal"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </UDropdownMenu>
      </div>
    </div>

    <draggable
      v-model="localTasks"
      :group="{ name: 'tasks', pull: true, put: true }"
      item-key="id"
      class="flex-1 p-2 space-y-2 overflow-y-auto min-h-16"
      ghost-class="opacity-40"
      drag-class="cursor-grabbing"
      animation="150"
      @change="onChange"
    >
      <template #item="{ element }">
        <TaskCard :task="element" :workspace-id="workspaceId" />
      </template>
    </draggable>

    <TaskCreateModal
      v-if="canCreate"
      v-model:open="createOpen"
      :workspace-id="workspaceId"
      :board-id="boardId"
      :column-id="column.id"
    />
  </div>
</template>
