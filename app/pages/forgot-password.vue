<script setup lang="ts">
import { z } from 'zod'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Забыли пароль — Scrumban' })

const schema = z.object({
  email: z.string().email('Введи корректный email').max(255),
})

type State = z.infer<typeof schema>
const state = reactive<State>({ email: '' })

const submitting = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  submitting.value = true
  error.value = null
  try {
    await $fetch(apiRoutes.authForgotPassword, {
      method: 'POST',
      body: { email: state.email },
    })
    submitted.value = true
  }
  catch (err) {
    error.value = getErrorMessage(err, 'Не удалось отправить письмо')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">Сброс пароля</h1>
      <p class="text-sm text-muted leading-relaxed">
        Введите email — отправим ссылку для установки нового пароля.
      </p>
    </div>

    <div v-if="submitted" class="space-y-6">
      <div class="rounded-xl border border-default bg-elevated/60 p-5 space-y-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-mail-check" class="size-5 text-success-600" />
          <p class="font-medium">Письмо отправлено</p>
        </div>
        <p class="text-sm text-muted">
          Если аккаунт с email <span class="font-medium text-default">{{ state.email }}</span> существует, мы отправили на него ссылку для сброса пароля. Ссылка действует 1 час.
        </p>
      </div>
      <UButton :to="pageRoutes.login" block size="xl" variant="ghost" color="neutral">
        Назад ко входу
      </UButton>
    </div>

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit.prevent="onSubmit"
    >
      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" size="lg" class="w-full" autofocus />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="error"
        icon="i-lucide-alert-circle"
      />
      <UButton type="submit" :loading="submitting" block size="xl" class="font-semibold">
        Отправить ссылку
      </UButton>
      <p class="text-sm text-muted text-center">
        Вспомнили пароль?
        <NuxtLink :to="pageRoutes.login" class="text-primary font-medium hover:underline">
          Войти
        </NuxtLink>
      </p>
    </UForm>
  </div>
</template>