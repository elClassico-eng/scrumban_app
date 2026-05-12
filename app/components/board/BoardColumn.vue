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
const { update: updateColumn, remove: removeColumn } = useColumnsApi(wsId, bId)
const confirm = useConfirm()
const toast = useToast()

const isEditing = ref(false)
const draftName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startEdit() {
  if (!props.canManage) return
  draftName.value = props.column.name
  isEditing.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function cancelEdit() {
  isEditing.value = false
  draftName.value = ''
}

async function commitEdit() {
  const trimmed = draftName.value.trim()
  if (!trimmed || trimmed === props.column.name) {
    cancelEdit()
    return
  }
  try {
    await updateColumn.mutateAsync({ columnId: props.column.id, name: trimmed })
    isEditing.value = false
  }
  catch {
    toast.add({
      title: 'Не удалось переименовать колонку',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

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
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить колонку'),
      color: getErrorStatus(err) === 422 ? 'warning' : 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const menuItems = computed(() => [[
  {
    label: 'Переименовать',
    icon: 'i-lucide-pencil',
    onSelect: startEdit,
  },
  {
    label: 'Удалить колонку',
    icon: 'i-lucide-trash-2',
    onSelect: onDeleteColumn,
  },
]])

const roleStyle = computed(() => COLUMN_ROLE_INFO[props.column.columnRole])
</script>

<template>
  <div
    :class="[
      'w-72 shrink-0 rounded-lg flex flex-col max-h-full border border-default',
      roleStyle.bodyClass,
    ]"
  >
    <div class="px-2 py-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <UIcon
          v-if="canManage"
          name="i-lucide-grip-vertical"
          class="column-drag-handle size-4 text-muted hover:text-default cursor-grab active:cursor-grabbing shrink-0"
          title="Перетащи, чтобы переставить колонку"
        />
        <div
          :class="[
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md min-w-0 flex-1',
            roleStyle.chipClass,
          ]"
        >
          <span :class="['size-1.5 rounded-full shrink-0', roleStyle.dotClass]" />
          <input
            v-if="isEditing"
            ref="nameInputRef"
            v-model="draftName"
            class="font-semibold text-xs uppercase tracking-wide bg-transparent border-b border-current outline-none min-w-0 flex-1"
            :disabled="updateColumn.isPending.value"
            @keyup.enter="commitEdit"
            @keyup.esc="cancelEdit"
            @blur="commitEdit"
          >
          <h3
            v-else
            class="font-semibold text-xs uppercase tracking-wide truncate min-w-0 flex-1"
            :class="canManage ? 'cursor-text' : ''"
            :title="canManage ? 'Двойной клик — переименовать' : ''"
            @dblclick="startEdit"
          >
            {{ column.name }}
          </h3>
          <span class="text-xs font-medium opacity-70 shrink-0">{{ localTasks.length }}</span>
        </div>
        <UBadge
          v-if="wipState"
          :color="wipState.over ? 'error' : 'neutral'"
          variant="subtle"
          size="xs"
          class="shrink-0"
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
