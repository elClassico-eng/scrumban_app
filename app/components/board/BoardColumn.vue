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

const wipBarState = computed(() => {
  const limit = props.column.wipLimit
  if (limit == null || limit === 0) return null
  const count = localTasks.value.length
  let tone: 'normal' | 'warn' | 'over' = 'normal'
  if (count > limit) tone = 'over'
  else if (count === limit) tone = 'warn'
  return {
    limit,
    count,
    tone,
    pct: Math.min(100, (count / limit) * 100),
  }
})
</script>

<template>
  <div class="w-[312px] shrink-0 rounded-xl flex flex-col max-h-full bg-white border border-default">
    <div class="px-3 pt-3 pb-2.5">
      <div class="flex items-center gap-2 mb-1.5">
        <UIcon
          v-if="canManage"
          name="i-lucide-grip-vertical"
          class="column-drag-handle size-3.5 text-zinc-300 hover:text-default cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Перетащи, чтобы переставить колонку"
        />
        <span :class="['size-2.5 rounded-full shrink-0', roleStyle.dotClass]" />
        <input
          v-if="isEditing"
          ref="nameInputRef"
          v-model="draftName"
          class="font-semibold text-[11.5px] uppercase tracking-[0.05em] text-default bg-transparent border-b border-zinc-400 outline-none min-w-0 flex-1"
          :disabled="updateColumn.isPending.value"
          @keyup.enter="commitEdit"
          @keyup.esc="cancelEdit"
          @blur="commitEdit"
        >
        <h3
          v-else
          class="font-semibold text-[11.5px] uppercase tracking-[0.05em] truncate min-w-0 flex-1 text-default"
          :class="canManage ? 'cursor-text' : ''"
          :title="canManage ? 'Двойной клик — переименовать' : ''"
          @dblclick="startEdit"
        >
          {{ column.name }}
        </h3>
        <span
          :class="[
            'text-[12px] font-mono tabular-nums shrink-0 whitespace-nowrap',
            wipBarState?.tone === 'over' ? 'text-red-600' : 'text-muted',
          ]"
          :title="wipBarState ? `WIP-лимит ${wipBarState.limit}` : 'Без WIP-лимита'"
        >
          <b
            :class="[
              'font-semibold',
              wipBarState?.tone === 'over' ? 'text-red-600' : wipBarState?.tone === 'warn' ? 'text-accent-600' : 'text-default',
            ]"
          >{{ localTasks.length }}</b>
          <template v-if="wipBarState"> / {{ wipBarState.limit }}</template>
        </span>
        <UDropdownMenu v-if="canManage" :items="menuItems" :ui="{ content: 'w-44' }">
          <button
            type="button"
            class="size-6 rounded-md grid place-items-center text-muted hover:bg-zinc-100 hover:text-default transition-colors cursor-pointer"
            title="Действия"
          >
            <UIcon name="i-lucide-more-horizontal" class="size-3.5" />
          </button>
        </UDropdownMenu>
      </div>
      <div v-if="wipBarState" class="h-[3px] rounded-full bg-zinc-100 overflow-hidden">
        <div
          :class="[
            'h-full rounded-full transition-[width] duration-300',
            wipBarState.tone === 'over' ? 'bg-red-500' : wipBarState.tone === 'warn' ? 'bg-accent-500' : 'bg-brand-500',
          ]"
          :style="{ width: `${wipBarState.pct}%` }"
        />
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

    <button
      v-if="canCreate"
      type="button"
      class="mx-2 mb-2 mt-0 px-3 py-2 rounded-md text-[13px] text-muted hover:text-accent-600 hover:bg-accent-50 border border-dashed border-transparent hover:border-accent-500 flex items-center gap-2 transition-colors cursor-pointer"
      @click="createOpen = true"
    >
      <UIcon name="i-lucide-plus" class="size-3.5" />
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
