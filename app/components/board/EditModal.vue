<script setup lang="ts">
import { z } from 'zod'
import { BOARD_COLOR_RE } from '#shared/constants/board-colors'

const props = defineProps<{ workspaceId: string }>()

const { editTarget } = useBoardActions(() => props.workspaceId)
const open = computed({
  get: () => editTarget.value !== null,
  set: (v) => { if (!v) editTarget.value = null },
})

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  slug: z.string().trim().toLowerCase().min(3, 'Минимум 3 символа').max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Только латиница, цифры и дефисы'),
  color: z.string().regex(BOARD_COLOR_RE),
  icon: z.string().nullable(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', slug: '', color: '', icon: null })

const { update } = useBoardsApi(computed(() => props.workspaceId))

const errorMessage = computed(() =>
  update.isError.value ? getErrorMessage(update.error.value, 'Не удалось сохранить') : null,
)

watch(editTarget, (board) => {
  if (!board) return
  Object.assign(state, { name: board.name, slug: board.slug, color: board.color, icon: board.icon })
  update.reset()
}, { immediate: true })

async function onSubmit() {
  const board = editTarget.value
  if (!board) return
  try {
    await update.mutateAsync({ boardId: board.id, name: state.name.trim(), slug: state.slug, color: state.color, icon: state.icon })
    open.value = false
  }
  catch {
    // mutation state captured the error
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Изменить доску" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Название" name="name" required>
          <UInput v-model="state.name" class="w-full" autofocus />
        </UFormField>
        <UFormField
          label="Slug"
          name="slug"
          hint="URL-идентификатор: латиница, цифры и дефисы"
          required
        >
          <UInput v-model="state.slug" class="w-full" />
        </UFormField>
        <UFormField label="Аватарка и цвет" name="color">
          <BoardAppearancePicker v-model:color="state.color" v-model:icon="state.icon" :name="state.name" class="pt-1" />
        </UFormField>
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="errorMessage"
          icon="i-hugeicons-alert-circle"
        />
        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
