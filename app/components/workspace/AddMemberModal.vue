<script setup lang="ts">
import { z } from 'zod'
import type { Role } from '#shared/types/domain'

const props = defineProps<{ workspaceId: string }>()
const open = defineModel<boolean>('open', { default: false })

const ROLE_OPTIONS: Array<{ label: string; value: Role }> = [
  { label: 'Наблюдатель', value: 'viewer' },
  { label: 'Участник', value: 'member' },
  { label: 'Скрам-мастер', value: 'scrum_master' },
  { label: 'Администратор', value: 'admin' },
]

const schema = z.object({
  email: z.string().email('Введи корректный email'),
  role: z.enum(['viewer', 'member', 'scrum_master', 'admin', 'owner']),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ email: '', role: 'member' })

const wsId = computed(() => props.workspaceId)
const { add } = useMembersApi(wsId)

const errorMessage = computed(() =>
  add.isError.value ? getErrorMessage(add.error.value, 'Не удалось добавить участника') : null,
)

function resetForm() {
  state.email = ''
  state.role = 'member'
  add.reset()
}

async function onSubmit() {
  try {
    await add.mutateAsync(state)
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
  <UModal v-model:open="open" title="Добавить участника" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField
          label="Email"
          name="email"
          hint="Пользователь уже должен быть зарегистрирован"
          required
        >
          <UInput v-model="state.email" type="email" class="w-full" autofocus />
        </UFormField>
        <UFormField label="Роль" name="role" required>
          <USelect v-model="state.role" :items="ROLE_OPTIONS" class="w-full" />
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
          <UButton type="submit" :loading="add.isPending.value">
            Добавить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>