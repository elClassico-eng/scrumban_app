<script setup lang="ts">
import { z } from 'zod'

const schema = z
  .object({
    email: z.string().email('Введи корректный email'),
    password: z.string().min(8, 'Минимум 8 символов'),
    confirmPassword: z.string().min(1, 'Повтори пароль'),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type RegisterState = z.infer<typeof schema>

const state = reactive<RegisterState>({ email: '', password: '', confirmPassword: '' })

const { register } = useAuthApi()

const errorMessage = computed(() => {
  if (!register.isError.value) return null
  const err = register.error.value as { statusCode?: number } | null
  if (err?.statusCode === 409) return 'Пользователь с таким email уже существует'
  return 'Не удалось зарегистрироваться, попробуй позже'
})

function onSubmit() {
  // Backend RegisterSchema is {email, password} — confirmPassword is a
  // client-side cross-field check only.
  register.mutate({ email: state.email, password: state.password })
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Email" name="email" required>
      <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
    </UFormField>
    <UFormField label="Пароль" name="password" hint="Минимум 8 символов" required>
      <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
    </UFormField>
    <UFormField label="Повторите пароль" name="confirmPassword" required>
      <UInput v-model="state.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
    </UFormField>
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :title="errorMessage"
      icon="i-lucide-alert-circle"
    />
    <UButton type="submit" :loading="register.isPending.value" block size="lg">
      Создать аккаунт
    </UButton>
  </UForm>
</template>