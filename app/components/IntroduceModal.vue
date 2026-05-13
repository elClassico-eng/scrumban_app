<script setup lang="ts">
import { z } from 'zod'

const authStore = useAuthStore()
const { update } = useProfileApi()
const toast = useToast()

const needsBackfill = computed(() => {
  const u = authStore.user
  if (!u) return false
  return !u.firstName && !u.lastName
})

const open = ref(false)
const dismissed = ref(false)

watchEffect(() => {
  if (needsBackfill.value && !dismissed.value) {
    open.value = true
  }
})

const schema = z.object({
  firstName: z.string().trim().min(1, 'Введи имя').max(100),
  lastName: z.string().trim().min(1, 'Введи фамилию').max(100),
})
type State = z.infer<typeof schema>
const state = reactive<State>({ firstName: '', lastName: '' })

async function onSubmit() {
  try {
    await update.mutateAsync({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
    })
    open.value = false
    toast.add({
      title: 'Профиль сохранён',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function skipForNow() {
  dismissed.value = true
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="false"
    :ui="{ content: 'max-w-md' }"
  >
    <template #content>
      <UForm :state="state" :schema="schema" class="space-y-4 p-6" @submit.prevent="onSubmit">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">Давайте знакомиться</h2>
          <p class="text-sm text-muted">
            Заполните имя и фамилию — коллеги будут видеть их вместо email на задачах и в истории.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Фамилия" name="lastName" required>
            <UInput v-model="state.lastName" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Имя" name="firstName" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" @click="skipForNow">
            Позже
          </UButton>
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>