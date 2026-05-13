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

const settingsOpen = ref(false)
const settingsDraft = reactive({
  wipLimit: null as number | null,
  columnRole: 'in_progress' as typeof props.column.columnRole,
})

function openSettings() {
  if (!props.canManage) return
  settingsDraft.wipLimit = props.column.wipLimit
  settingsDraft.columnRole = props.column.columnRole
  settingsOpen.value = true
}

async function onSaveSettings() {
  const wipLimit
    = settingsDraft.wipLimit && settingsDraft.wipLimit > 0
      ? Math.floor(settingsDraft.wipLimit)
      : null
  try {
    await updateColumn.mutateAsync({
      columnId: props.column.id,
      wipLimit,
      columnRole: settingsDraft.columnRole,
    })
    settingsOpen.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить настройки'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

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
  ...(props.canCreate
    ? [{
        label: 'Создать задачу',
        icon: 'i-lucide-plus',
        onSelect: () => { createOpen.value = true },
      }]
    : []),
  {
    label: 'Переименовать',
    icon: 'i-lucide-pencil',
    onSelect: startEdit,
  },
  {
    label: 'Настройки колонки',
    icon: 'i-lucide-settings',
    onSelect: openSettings,
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
      'w-72 shrink-0 rounded-lg flex flex-col max-h-full',
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
          <span
            class="text-xs font-semibold shrink-0 tabular-nums"
            :class="wipState?.over ? 'text-red-700 dark:text-red-300' : 'opacity-70'"
            :title="wipState ? `WIP-лимит ${wipState.limit}` : 'Без WIP-лимита'"
          >
            {{ localTasks.length }}{{ wipState ? `/${wipState.limit}` : '' }}
          </span>
        </div>
      </div>
      <UDropdownMenu v-if="canManage" :items="menuItems">
        <UButton
          icon="i-lucide-more-horizontal"
          color="neutral"
          variant="ghost"
          size="xs"
        />
      </UDropdownMenu>
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

    <button
      v-if="canCreate"
      type="button"
      class="m-2 mt-0 px-3 py-1.5 text-sm text-muted hover:text-default hover:bg-accented/60 rounded-md flex items-center gap-1.5 transition-colors"
      @click="createOpen = true"
    >
      <UIcon name="i-lucide-plus" class="size-4" />
      Добавить задачу
    </button>

    <TaskCreateModal
      v-if="canCreate"
      v-model:open="createOpen"
      :workspace-id="workspaceId"
      :board-id="boardId"
      :column-id="column.id"
    />

    <UModal
      v-if="canManage"
      v-model:open="settingsOpen"
      :title="`Настройки колонки «${column.name}»`"
      :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Тип"
            name="columnRole"
            :description="COLUMN_ROLE_INFO[settingsDraft.columnRole].hint"
          >
            <USelect
              v-model="settingsDraft.columnRole"
              :items="COLUMN_ROLE_OPTIONS"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="WIP-лимит"
            name="wipLimit"
            description="Максимум задач в колонке. Пусто или 0 — без лимита."
          >
            <UInput
              :model-value="settingsDraft.wipLimit ?? undefined"
              type="number"
              min="0"
              class="w-full"
              placeholder="Без лимита"
              @update:model-value="(v: string | number) => (settingsDraft.wipLimit = v === '' || v == null ? null : Number(v))"
            />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="settingsOpen = false">
              Отмена
            </UButton>
            <UButton :loading="updateColumn.isPending.value" @click="onSaveSettings">
              Сохранить
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
