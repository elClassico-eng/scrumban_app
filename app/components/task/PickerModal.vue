<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'

const props = withDefaults(defineProps<{
  tasks: Task[]
  columns: BoardColumn[]
  excludeIds?: string[]
  placeholder?: string
  title?: string
  multiple?: boolean
}>(), {
  excludeIds: () => [],
  placeholder: 'Поиск задачи...',
  title: 'Выбрать задачу',
  multiple: false,
})

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  select: [taskId: string]
  selectMany: [taskIds: string[]]
}>()

const excludeSet = computed(() => new Set(props.excludeIds))

// Items keyed by id so we can resolve the multi-select v-model back to task
// IDs cheaply. UCommandPalette's v-model with multiple=true gives us the
// raw item objects, not their ids.
const groups = computed(() =>
  buildColumnGroups(
    props.columns,
    props.tasks.filter(t => !excludeSet.value.has(t.id)),
    (t, col) => ({
      id: t.id,
      label: t.title,
      chip: { color: COLUMN_ROLE_INFO[col.columnRole].chipColor, size: 'sm' as const },
      // In single mode we close on item click; in multi mode the v-model
      // handles selection and we close via the explicit submit button.
      onSelect: props.multiple ? undefined : () => onSinglePick(t.id),
    }),
  ),
)

function onSinglePick(taskId: string) {
  emit('select', taskId)
  open.value = false
}

const selected = ref<Array<{ id: string }>>([])

watch(open, (v) => {
  if (!v) selected.value = []
})

function onSubmit() {
  if (selected.value.length === 0) {
    open.value = false
    return
  }
  emit('selectMany', selected.value.map(i => i.id))
  selected.value = []
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :overlay="true"
    :title="title"
    :ui="{
      content: 'max-w-xl p-0',
      overlay: 'bg-black/70',
    }"
  >
    <template #content>
      <UCommandPalette
        v-if="multiple"
        v-model="selected"
        :groups="groups"
        :placeholder="placeholder"
        multiple
        :close="{ onClick: () => { open = false } }"
      />
      <UCommandPalette
        v-else
        :groups="groups"
        :placeholder="placeholder"
        :close="{ onClick: () => { open = false } }"
      />
      <div
        v-if="multiple"
        class="flex items-center justify-between gap-3 px-4 py-3 border-t border-default"
      >
        <span class="text-xs text-muted">
          Выбрано: {{ selected.length }}
        </span>
        <div class="flex items-center gap-2">
          <UButton variant="ghost" color="neutral" size="sm" @click="open = false">
            Отмена
          </UButton>
          <UButton size="sm" :disabled="selected.length === 0" @click="onSubmit">
            Добавить
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
