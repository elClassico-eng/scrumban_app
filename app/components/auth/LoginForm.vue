<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Введи корректный email'),
  password: z.string().min(1, 'Введи пароль'),
})

type LoginState = z.infer<typeof schema>

const state = reactive<LoginState>({ email: '', password: '' })

const { login } = useAuthApi()

const errorMessage = computed(() =>
  login.isError.value ? getErrorMessage(login.error.value, 'Не удалось войти, попробуй позже') : null,
)

function onSubmit() {
  login.mutate(state)
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Email" name="email" required>
      <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
    </UFormField>
    <UFormField label="Пароль" name="password" required>
      <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
    </UFormField>
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :title="errorMessage"
      icon="i-lucide-alert-circle"
    />
    <UButton type="submit" :loading="login.isPending.value" block size="lg">
      Войти
    </UButton>
  </UForm>
</template>