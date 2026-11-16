<script setup lang="ts">
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth', colorMode: 'light', cardMaxWidth: 'lg:max-w-xl' })
useHead({ title: 'Регистрация – Такт' })

const route = useRoute()

type Step = 1 | 2
const step = ref<Step>(1)

const personalSchema = z.object({
  firstName: z.string().trim().min(1, 'Введите имя').max(100),
  lastName: z.string().trim().min(1, 'Введите фамилию').max(100),
  middleName: z.string().trim().max(100).optional(),
})

const credentialsSchema = z
  .object({
    email: z.email('Введите корректный email').max(255),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type PersonalState = z.infer<typeof personalSchema>
type CredentialsState = z.infer<typeof credentialsSchema>

const personalState = reactive<PersonalState>({
  firstName: '',
  lastName: '',
  middleName: '',
})

const credentialsState = reactive<CredentialsState>({
  email: '',
  password: '',
  confirmPassword: '',
})

const consent = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

function goToCredentials() {
  const parsed = personalSchema.safeParse(personalState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполните все поля'
    return
  }
  submitError.value = null
  step.value = 2
}

function back() {
  submitError.value = null
  step.value = 1
}

provideAuthStepper({
  step,
  total: 2,
  next: () => {
    if (step.value === 1) goToCredentials()
  },
  prev: back,
})

async function createAccount() {
  const parsed = credentialsSchema.safeParse(credentialsState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполните все поля'
    return
  }
  if (!consent.value) {
    submitError.value = 'Подтвердите согласие на обработку персональных данных'
    return
  }

  submitting.value = true
  submitError.value = null
  try {
    await $fetch(apiRoutes.authRegister, {
      method: 'POST',
      body: {
        email: credentialsState.email,
        password: credentialsState.password,
        firstName: personalState.firstName,
        lastName: personalState.lastName,
        middleName: personalState.middleName || undefined,
        consent: true,
      },
    })
    const nextParam = (route.query.next as string | undefined) ?? ''
    const isSafeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('://')
    window.location.href = isSafeNext ? nextParam : pageRoutes.workspaces
  }
  catch (err) {
    submitError.value = getErrorMessage(err, 'Не удалось завершить регистрацию')
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <TaktLoader v-if="submitting" label="Создаём аккаунт…" />
    <div class="space-y-3">
      <p class="text-[11px] uppercase tracking-[0.18em] text-muted font-medium">
        Шаг {{ step }} из 2
      </p>
      <div class="flex items-center gap-1.5">
        <div
          v-for="i in 2"
          :key="i"
          class="h-1 flex-1 rounded-full transition-colors"
          :class="step >= i ? 'bg-primary' : 'bg-default/40'"
        />
      </div>
    </div>

    <UForm
      v-if="step === 1"
      :state="personalState"
      :schema="personalSchema"
      class="space-y-6"
      @submit.prevent="goToCredentials"
    >
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">Расскажите о себе</h1>
        <p class="text-sm text-muted leading-relaxed">
          Эти данные увидят коллеги в задачах и комментариях.
        </p>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormField label="Фамилия" name="lastName" required>
            <UInput v-model="personalState.lastName" size="lg" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Имя" name="firstName" required>
            <UInput v-model="personalState.firstName" size="lg" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Отчество" name="middleName">
          <UInput v-model="personalState.middleName" size="lg" class="w-full" placeholder="Можно пропустить" />
        </UFormField>
      </div>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        :title="submitError"
        icon="i-hugeicons-alert-circle"
      />
      <UButton type="submit" block size="xl" class="font-semibold">
        Дальше
      </UButton>
      <p class="text-sm text-muted text-center">
        Уже есть аккаунт?
        <NuxtLink :to="pageRoutes.login" class="text-primary font-medium hover:underline">
          Войти
        </NuxtLink>
      </p>
    </UForm>

    <UForm
      v-else
      :state="credentialsState"
      :schema="credentialsSchema"
      class="space-y-6"
      @submit.prevent="createAccount"
    >
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">Учётные данные</h1>
        <p class="text-sm text-muted leading-relaxed">
          С этим email и паролем будете заходить в Такт.
        </p>
      </div>
      <div class="space-y-4">
        <UFormField label="Email" name="email" required>
          <UInput v-model="credentialsState.email" type="email" autocomplete="email" size="lg" class="w-full" autofocus />
        </UFormField>
        <UFormField label="Пароль" name="password" required>
          <UInput v-model="credentialsState.password" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <AuthPasswordStrengthChecklist :password="credentialsState.password" class="pl-1" />
        <UFormField label="Повторите пароль" name="confirmPassword" required>
          <UInput v-model="credentialsState.confirmPassword" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <div class="space-y-2 pt-1">
          <UCheckbox v-model="consent" required>
            <template #label>
              Даю
              <a :href="pageRoutes.consent" target="_blank" rel="noopener" class="text-primary hover:underline" @click.stop>согласие на обработку персональных данных</a>
            </template>
          </UCheckbox>
          <p class="text-xs text-muted leading-relaxed">
            Регистрируясь, вы принимаете
            <a :href="pageRoutes.terms" target="_blank" rel="noopener" class="hover:underline">Пользовательское соглашение</a>
            и
            <a :href="pageRoutes.privacy" target="_blank" rel="noopener" class="hover:underline">Политику обработки персональных данных</a>.
          </p>
        </div>
      </div>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        :title="submitError"
        icon="i-hugeicons-alert-circle"
      />
      <div class="grid grid-cols-[auto_1fr] gap-3 pt-2">
        <UButton type="button" variant="ghost" color="neutral" size="xl" @click="back">
          Назад
        </UButton>
        <UButton type="submit" :loading="submitting" :disabled="!consent" block size="xl" class="font-semibold">
          Создать аккаунт
        </UButton>
      </div>
    </UForm>
  </div>
</template>
