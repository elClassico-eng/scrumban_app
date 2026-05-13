<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'

const props = withDefaults(defineProps<{
  tasks: Task[]
  columns: BoardColumn[]
  excludeIds?: string[]
  placeholder?: string
  title?: string
}>(), {
  excludeIds: () => [],
  placeholder: 'Поиск задачи...',
  title: 'Выбрать задачу',
})

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  select: [taskId: string]
}>()

const excludeSet = computed(() => new Set(props.excludeIds))

const groups = computed(() =>
  buildColumnGroups(
    props.columns,
    props.tasks.filter(t => !excludeSet.value.has(t.id)),
    (t, col) => ({
      label: t.title,
      chip: { color: COLUMN_ROLE_INFO[col.columnRole].chipColor, size: 'sm' as const },
      onSelect: () => onPick(t.id),
    }),
  ),
)

function onPick(taskId: string) {
  emit('select', taskId)
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
        :groups="groups"
        :placeholder="placeholder"
        :close="{ onClick: () => { open = false } }"
      />
    </template>
  </UModal>
</template>
