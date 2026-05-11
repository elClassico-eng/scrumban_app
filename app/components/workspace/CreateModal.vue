<script setup lang="ts">
import { z } from 'zod'
import { pageRoutes } from '~/routing'

const open = defineModel<boolean>('open', { default: false })

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
  slug: z.string().trim().toLowerCase().min(3, 'Минимум 3 символа').max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Только латиница, цифры и дефисы'),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ name: '', slug: '' })

const slugTouched = ref(false)
watch(() => state.name, (name) => {
  if (!slugTouched.value) state.slug = slugify(name)
})

const { create } = useWorkspacesApi()
const workspaceStore = useWorkspaceStore()
const router = useRouter()

const errorMessage = computed(() => {
  if (!create.isError.value) return null
  const err = create.error.value as { statusCode?: number; data?: { message?: string } } | null
  if (err?.statusCode === 409) return 'Workspace с таким slug уже существует'
  return err?.data?.message ?? 'Не удалось создать workspace'
})

function resetForm() {
  state.name = ''
  state.slug = ''
  slugTouched.value = false
  create.reset()
}

async function onSubmit() {
  try {
    const result = await create.mutateAsync(state)
    workspaceStore.setCurrent(result.workspace.id)
    open.value = false
    resetForm()
    router.push(pageRoutes.boards(result.workspace.id))
  }
  catch {
    // mutation captured the error; UAlert displays it
  }
}

watch(open, (v) => {
  if (!v) resetForm()
})
</script>

<template>
  <UModal v-model:open="open" title="Новый workspace" :ui="{ content: 'max-w-md' }">
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
          <UButton type="submit" :loading="create.isPending.value">
            Создать
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>