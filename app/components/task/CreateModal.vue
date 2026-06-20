<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  workspaceId: string
  boardId: string
  columnId: string
  parentTaskId?: string | null
  parentTitle?: string | null
  initialDueDate?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })

const schema = z
  .object({
    title: z.string().trim().min(1, 'Введи название').max(255),
    description: z.string().max(20_000).optional(),
    serviceClass: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']),
    dueDate: z.string().optional(),
    assigneeId: z.string().nullable(),
  })
  .refine(d => d.serviceClass !== 'fixed_date' || (d.dueDate && d.dueDate.length > 0), {
    message: 'Для класса «С дедлайном» нужен дедлайн',
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
    label: displayName(m),
    value: m.userId,
    avatar: m.avatarUrl ? { src: m.avatarUrl, alt: displayName(m) } : { text: initials(m) },
  })),
])

const errorMessage = computed(() =>
  create.isError.value ? getErrorMessage(create.error.value, 'Не удалось создать задачу') : null,
)

function resetForm() {
  state.title = ''
  state.description = ''
  state.serviceClass = 'standard'
  state.dueDate = props.initialDueDate ?? ''
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
      dueDate: state.dueDate
        ? new Date(`${state.dueDate}T23:59:59Z`).toISOString()
        : null,
      assigneeId: state.assigneeId,
      parentTaskId: props.parentTaskId ?? null,
    })
    open.value = false
    resetForm()
  }
  catch {
    // surfaced via UAlert
  }
}

watch(open, (v) => {
  if (v) state.dueDate = props.initialDueDate ?? ''
  else resetForm()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="parentTaskId ? 'Новая подзадача' : 'Новая задача'"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" :on-submit="onSubmit">
        <div
          v-if="parentTaskId && parentTitle"
          class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-elevated text-[12.5px] text-default"
        >
          <UIcon name="i-lucide-corner-down-right" class="size-3.5 text-muted shrink-0" />
          <span class="text-muted shrink-0">Родитель:</span>
          <span class="truncate">{{ parentTitle }}</span>
        </div>
        <UFormField label="Название" name="title" required>
          <UInput v-model="state.title" class="w-full" autofocus />
        </UFormField>
        <UFormField label="Описание" name="description">
          <UTextarea v-model="state.description" :rows="4" class="w-full" />
        </UFormField>
        <UFormField
          label="Класс обслуживания"
          name="serviceClass"
          :description="SERVICE_CLASS_INFO[state.serviceClass].hint"
          required
        >
          <USelect v-model="state.serviceClass" :items="SERVICE_CLASS_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField
          label="Дедлайн"
          name="dueDate"
          :required="state.serviceClass === 'fixed_date'"
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