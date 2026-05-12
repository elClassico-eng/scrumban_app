<script setup lang="ts">
import { z } from 'zod'
import type { ServiceClass } from '#shared/types/domain'

const props = defineProps<{
  workspaceId: string
  boardId: string
  columnId: string
}>()
const open = defineModel<boolean>('open', { default: false })

const SERVICE_CLASS_OPTIONS: Array<{ label: string; value: ServiceClass }> = [
  { label: 'Standard — обычный поток', value: 'standard' },
  { label: 'Expedite — срочно, обходит WIP', value: 'expedite' },
  { label: 'Fixed Date — есть дедлайн', value: 'fixed_date' },
  { label: 'Intangible — когда есть время', value: 'intangible' },
]

const schema = z
  .object({
    title: z.string().trim().min(1, 'Введи название').max(255),
    description: z.string().max(20_000).optional(),
    serviceClass: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']),
    dueDate: z.string().optional(),
    assigneeId: z.string().nullable(),
  })
  .refine(d => d.serviceClass !== 'fixed_date' || (d.dueDate && d.dueDate.length > 0), {
    message: 'Для Fixed Date задайте дедлайн',
    path: ['dueDate'],
  })

type State = z.infer<typeof schema>
const state = reactive<State>({
  title: '',
  description: '',
  serviceClass: 'standard',
  dueDate: '',
  assigneeId: null,
})

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
  state.serviceClass = 'standard'
  state.dueDate = ''
  state.assigneeId = null
  create.reset()
}

async function onSubmit() {
  try {
    await create.mutateAsync({
      columnId: props.columnId,
      title: state.title,
      description: state.description || undefined,
      serviceClass: state.serviceClass,
      dueDate:
        state.serviceClass === 'fixed_date' && state.dueDate
          ? new Date(`${state.dueDate}T23:59:59Z`).toISOString()
          : null,
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
        <UFormField label="Класс обслуживания" name="serviceClass" required>
          <USelect v-model="state.serviceClass" :items="SERVICE_CLASS_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField
          v-if="state.serviceClass === 'fixed_date'"
          label="Дедлайн"
          name="dueDate"
          required
        >
          <UInput v-model="state.dueDate" type="date" class="w-full" />
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