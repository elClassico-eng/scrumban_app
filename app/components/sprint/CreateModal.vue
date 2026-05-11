<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{ workspaceId: string; boardId: string }>()
const open = defineModel<boolean>('open', { default: false })

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  goal: z.string().max(10_000).optional(),
  plannedStartAt: z.string().optional(),
  plannedEndAt: z.string().optional(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', goal: '', plannedStartAt: '', plannedEndAt: '' })

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { create } = useSprintsApi(wsId, bId)

const errorMessage = computed(() => {
  if (!create.isError.value) return null
  const err = create.error.value as { statusCode?: number; data?: { message?: string } } | null
  if (err?.statusCode === 403) return 'Нужна роль scrum_master или выше для создания спринта'
  return err?.data?.message ?? 'Не удалось создать спринт'
})

function resetForm() {
  state.name = ''
  state.goal = ''
  state.plannedStartAt = ''
  state.plannedEndAt = ''
  create.reset()
}

function toIsoOrNull(value: string | undefined): string | null {
  if (!value) return null
  // <input type="date"> gives "YYYY-MM-DD"; backend expects ISO datetime.
  return new Date(value + 'T00:00:00Z').toISOString()
}

async function onSubmit() {
  try {
    await create.mutateAsync({
      name: state.name,
      goal: state.goal || undefined,
      plannedStartAt: toIsoOrNull(state.plannedStartAt),
      plannedEndAt: toIsoOrNull(state.plannedEndAt),
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
  <UModal v-model:open="open" title="Новый спринт" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" :on-submit="onSubmit">
        <UFormField label="Название" name="name" required>
          <UInput v-model="state.name" class="w-full" autofocus />
        </UFormField>
        <UFormField label="Цель" name="goal" hint="Что команда хочет сделать в этом спринте">
          <UTextarea v-model="state.goal" :rows="3" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Старт" name="plannedStartAt">
            <UInput v-model="state.plannedStartAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Конец" name="plannedEndAt">
            <UInput v-model="state.plannedEndAt" type="date" class="w-full" />
          </UFormField>
        </div>
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