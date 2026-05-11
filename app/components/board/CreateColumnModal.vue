<script setup lang="ts">
import { z } from 'zod'
import type { ColumnRole } from '#shared/types/column'

const props = defineProps<{ workspaceId: string; boardId: string }>()
const open = defineModel<boolean>('open', { default: false })

const ROLE_OPTIONS: Array<{ label: string; value: ColumnRole }> = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'На ревью', value: 'review' },
  { label: 'Готово', value: 'done' },
  { label: 'Архив', value: 'archived' },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  columnRole: z.enum(['backlog', 'in_progress', 'review', 'done', 'archived']),
  wipLimit: z.number().int().positive().nullable(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', columnRole: 'in_progress', wipLimit: null })

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { create } = useColumnsApi(wsId, bId)

const errorMessage = computed(() => {
  if (!create.isError.value) return null
  const err = create.error.value as { statusCode?: number; data?: { message?: string } } | null
  if (err?.statusCode === 403) return 'У тебя нет прав создавать колонки в этой доске'
  return err?.data?.message ?? 'Не удалось создать колонку'
})

function resetForm() {
  state.name = ''
  state.columnRole = 'in_progress'
  state.wipLimit = null
  create.reset()
}

async function onSubmit() {
  try {
    await create.mutateAsync({
      name: state.name,
      columnRole: state.columnRole,
      wipLimit: state.wipLimit,
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
  <UModal v-model:open="open" title="Новая колонка" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" :on-submit="onSubmit">
        <UFormField label="Название" name="name" required>
          <UInput v-model="state.name" class="w-full" autofocus />
        </UFormField>
        <UFormField
          label="Тип"
          name="columnRole"
          hint="Используется аналитикой для классификации потока"
          required
        >
          <USelect v-model="state.columnRole" :items="ROLE_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField
          label="WIP лимит"
          name="wipLimit"
          hint="Опционально. Максимум задач, которые можно держать в колонке"
        >
          <UInput
            :model-value="state.wipLimit ?? undefined"
            type="number"
            min="1"
            class="w-full"
            placeholder="Без лимита"
            @update:model-value="(v: string | number) => (state.wipLimit = v === '' || v == null ? null : Number(v))"
          />
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