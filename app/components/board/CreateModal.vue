<script setup lang="ts">
import { z } from 'zod'
import { BOARD_COLOR_RE, DEFAULT_BOARD_COLOR } from '#shared/constants/board-colors'

const props = defineProps<{ workspaceId: string }>()
const open = defineModel<boolean>('open', { default: false })

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  slug: z.string().trim().toLowerCase().min(3, 'Минимум 3 символа').max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Только латиница, цифры и дефисы'),
  color: z.string().regex(BOARD_COLOR_RE),
  seedDefaults: z.boolean(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', slug: '', color: DEFAULT_BOARD_COLOR, seedDefaults: true })

const slugTouched = ref(false)
watch(() => state.name, (name) => {
  if (!slugTouched.value) state.slug = slugify(name)
})

const wsId = computed(() => props.workspaceId)
const { create } = useBoardsApi(wsId)

const errorMessage = computed(() =>
  create.isError.value ? getErrorMessage(create.error.value, 'Не удалось создать доску') : null,
)

function resetForm() {
  state.name = ''
  state.slug = ''
  state.color = DEFAULT_BOARD_COLOR
  state.seedDefaults = true
  slugTouched.value = false
  create.reset()
}

async function onSubmit() {
  try {
    await create.mutateAsync(state)
    open.value = false
    resetForm()
  }
  catch {
    // mutation state captured the error
  }
}

watch(open, (v) => {
  if (!v) resetForm()
})
</script>

<template>
  <UModal v-model:open="open" title="Новая доска" :ui="{ content: 'max-w-md' }">
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
        <UFormField label="Цвет" name="color">
          <BoardColorPicker v-model="state.color" class="pt-1" />
        </UFormField>
        <UFormField name="seedDefaults">
          <UCheckbox
            v-model="state.seedDefaults"
            label="Использовать шаблон Scrumban (Backlog / В работе / На ревью / Готово)"
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