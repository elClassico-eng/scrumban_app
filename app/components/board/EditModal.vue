<script setup lang="ts">
import { z } from 'zod'
import type { Board } from '#shared/types/board'

const props = defineProps<{ workspaceId: string, board: Board }>()
const open = defineModel<boolean>('open', { default: false })

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  slug: z.string().trim().toLowerCase().min(3, 'Минимум 3 символа').max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Только латиница, цифры и дефисы'),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: props.board.name, slug: props.board.slug })

const slugTouched = ref(false)
watch(() => state.name, (name) => {
  if (!slugTouched.value) state.slug = slugify(name)
})

const wsId = computed(() => props.workspaceId)
const { update } = useBoardsApi(wsId)

const errorMessage = computed(() =>
  update.isError.value ? getErrorMessage(update.error.value, 'Не удалось сохранить') : null,
)

function syncFromBoard() {
  state.name = props.board.name
  state.slug = props.board.slug
  slugTouched.value = false
  update.reset()
}

async function onSubmit() {
  try {
    await update.mutateAsync({ boardId: props.board.id, name: state.name.trim(), slug: state.slug })
    open.value = false
  }
  catch {
    // mutation state captured the error
  }
}

watch(open, (v) => {
  if (v) syncFromBoard()
})
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
          <UInput
            v-model="state.slug"
            class="w-full"
            @update:model-value="slugTouched = true"
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
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
