<script setup lang="ts">
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Новый пароль — Scrumban' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const token = computed(() => String(route.params.token ?? ''))

type CheckState =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'expired' }
  | { kind: 'already_used' }
  | { kind: 'invalid' }
  | { kind: 'error', message: string }

const check = ref<CheckState>({ kind: 'loading' })

onMounted(async () => {
  try {
    const res = await $fetch<{ valid: boolean, reason?: string }>(
      apiRoutes.authResetPasswordStatus(token.value),
    )
    if (res.valid) check.value = { kind: 'valid' }
    else if (res.reason === 'expired') check.value = { kind: 'expired' }
    else if (res.reason === 'already_used') check.value = { kind: 'already_used' }
    else check.value = { kind: 'invalid' }
  }
  catch (err) {
    check.value = { kind: 'error', message: getErrorMessage(err, 'Не удалось проверить ссылку') }
  }
})

const schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type State = z.infer<typeof schema>
const state = reactive<State>({ password: '', confirmPassword: '' })

const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  submitting.value = true
  error.value = null
  try {
    await $fetch(apiRoutes.authResetPassword, {
      method: 'POST',
      body: { token: token.value, password: state.password },
    })
    toast.add({
      title: 'Пароль обновлён',
      description: 'Войдите с новым паролем.',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 2500,
    })
    await router.push(pageRoutes.login)
  }
  catch (err: unknown) {
    const reason = (err as { data?: { reason?: string } })?.data?.reason
    if (reason === 'expired') {
      error.value = 'Ссылка устарела. Запросите новую через «Забыли пароль?».'
    }
    else if (reason === 'already_used') {
      error.value = 'Ссылка уже использована. Войдите с новым паролем или запросите новую ссылку.'
    }
    else if (reason === 'not_found') {
      error.value = 'Ссылка недействительна.'
    }
    else {
      error.value = getErrorMessage(err, 'Не удалось обновить пароль')
    }
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <template v-if="check.kind === 'loading'">
      <div class="flex flex-col items-center gap-3 py-10">
        <UIcon name="i-lucide-loader" class="size-7 animate-spin text-primary" />
        <p class="text-sm text-muted">Проверяем ссылку...</p>
      </div>
    </template>

    <template v-else-if="check.kind === 'valid'">
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">Новый пароль</h1>
        <p class="text-sm text-muted leading-relaxed">
          Придумайте новый пароль для вашего аккаунта.
        </p>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-5"
        @submit.prevent="onSubmit"
      >
        <UFormField label="Новый пароль" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="new-password" size="lg" class="w-full" autofocus />
        </UFormField>
        <AuthPasswordStrengthChecklist :password="state.password" class="pl-1" />
        <UFormField label="Повторите пароль" name="confirmPassword" required>
          <UInput v-model="state.confirmPassword" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
          icon="i-lucide-alert-circle"
        />
        <UButton type="submit" :loading="submitting" block size="xl" class="font-semibold">
          Установить пароль
        </UButton>
        <p class="text-sm text-muted text-center">
          <NuxtLink :to="pageRoutes.login" class="text-primary font-medium hover:underline">
            Назад ко входу
          </NuxtLink>
        </p>
      </UForm>
    </template>

    <template v-else>
      <div class="space-y-3 text-center">
        <UIcon
          :name="check.kind === 'expired' ? 'i-lucide-clock' : 'i-lucide-x-circle'"
          :class="['size-12 mx-auto', check.kind === 'expired' ? 'text-warning-500' : 'text-error-500']"
        />
        <h1 class="text-2xl font-bold tracking-tight">
          {{
            check.kind === 'expired' ? 'Ссылка устарела'
            : check.kind === 'already_used' ? 'Ссылка уже использована'
            : 'Ссылка недействительна'
          }}
        </h1>
        <p class="text-sm text-muted">
          {{
            check.kind === 'expired' ? 'Запросите новую ссылку для сброса пароля.'
            : check.kind === 'already_used' ? 'Войдите с новым паролем или запросите ещё одну.'
            : 'Проверьте, что вы открыли последнюю ссылку из письма.'
          }}
        </p>
      </div>
      <div class="flex flex-col gap-3 pt-2">
        <UButton :to="pageRoutes.forgotPassword" block size="xl" class="font-semibold">
          Запросить новую ссылку
        </UButton>
        <UButton :to="pageRoutes.login" block size="xl" variant="ghost" color="neutral">
          Назад ко входу
        </UButton>
      </div>
    </template>
  </div>
</template>