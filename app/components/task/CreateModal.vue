<script setup lang="ts">
import { z } from 'zod'
import type { TaskPriority } from '#shared/types/domain'

const props = defineProps<{
  workspaceId: string
  boardId: string
  columnId: string
}>()
const open = defineModel<boolean>('open', { default: false })

const PRIORITY_OPTIONS: Array<{ label: string; value: TaskPriority }> = [
  { label: 'Низкий', value: 'low' },
  { label: 'Средний', value: 'medium' },
  { label: 'Высокий', value: 'high' },
]

const schema = z.object({
  title: z.string().trim().min(1, 'Введи название').max(255),
  description: z.string().max(20_000).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  assigneeId: z.string().nullable(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ title: '', description: '', priority: 'medium', assigneeId: null })

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { create } = useTasksApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)

const assigneeOptions = computed(() => [
  { label: 'Не назначен', value: null },
  ...(membersList.data.value?.members ?? []).map(m => ({
    label: m.email,
    value: m.userId,
  })),
])

const errorMessage = computed(() => {
  if (!create.isError.value) return null
  const err = create.error.value as { statusCode?: number; data?: { message?: string } } | null
  if (err?.statusCode === 403) return 'У тебя нет прав создавать задачи в этой доске'
  return err?.data?.message ?? 'Не удалось создать задачу'
})

function resetForm() {
  state.title = ''
  state.description = ''
  state.priority = 'medium'
  state.assigneeId = null
  create.reset()
}

async function onSubmit() {
  try {
    await create.mutateAsync({
      columnId: props.columnId,
      title: state.title,
      description: state.description || undefined,
      priority: state.priority,
      assigneeId: state.assigneeId,
    })
    open.value = false
    resetForm()
  }
  catch {
    // surfaced via UAlert
  }
}

watch(open, (v) => {
  if (!v) resetForm()
})
</script>

<template>
  <UModal v-model:open="open" title="Новая задача" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" :on-submit="onSubmit">
        <UFormField label="Название" name="title" required>
          <UInput v-model="state.title" class="w-full" autofocus />
        </UFormField>
        <UFormField label="Описание" name="description">
          <UTextarea v-model="state.description" :rows="4" class="w-full" />
        </UFormField>
        <UFormField label="Приоритет" name="priority" required>
          <USelect v-model="state.priority" :items="PRIORITY_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField label="Исполнитель" name="assigneeId">
          <USelect v-model="state.assigneeId" :items="assigneeOptions" class="w-full" />
        </UFormField>
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="errorMessage"
          icon="i-lucide-alert-circle"
        />
        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton type="submit" :loading="create.isPending.value">
            Создать
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>