<script setup lang="ts">
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth', cardMaxWidth: 'max-w-xl' })
useHead({ title: 'Регистрация — Scrumban' })

type Step = 1 | 2 | 3
const step = ref<Step>(1)

const personalSchema = z.object({
  firstName: z.string().trim().min(1, 'Введи имя').max(100),
  lastName: z.string().trim().min(1, 'Введи фамилию').max(100),
  middleName: z.string().trim().max(100).optional(),
})

const credentialsSchema = z
  .object({
    email: z.email('Введи корректный email').max(255),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

const teamSchema = z.object({
  name: z.string().trim().min(1, 'Введи название команды').max(255),
  slug: z.string().trim().toLowerCase().min(3, 'Минимум 3 символа').max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Только латиница, цифры и дефисы'),
  industry: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  purpose: z.string().trim().max(2000).optional(),
})

type PersonalState = z.infer<typeof personalSchema>
type CredentialsState = z.infer<typeof credentialsSchema>
type TeamState = z.infer<typeof teamSchema>

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

const teamState = reactive<TeamState>({
  name: '',
  slug: '',
  industry: '',
  description: '',
  purpose: '',
})

const slugTouched = ref(false)
watch(() => teamState.name, (name) => {
  if (!slugTouched.value) teamState.slug = slugify(name)
})

const submitting = ref(false)
const submitError = ref<string | null>(null)

function goToCredentials() {
  const parsed = personalSchema.safeParse(personalState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполни все поля'
    return
  }
  submitError.value = null
  step.value = 2
}

function goToTeam() {
  const parsed = credentialsSchema.safeParse(credentialsState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполни все поля'
    return
  }
  submitError.value = null
  step.value = 3
}

function back() {
  submitError.value = null
  if (step.value === 3) step.value = 2
  else if (step.value === 2) step.value = 1
}

async function finishOnboarding() {
  const parsed = teamSchema.safeParse(teamState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполни все поля'
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
      },
    })
    await $fetch(apiRoutes.workspaces, {
      method: 'POST',
      body: {
        name: teamState.name,
        slug: teamState.slug,
        industry: teamState.industry || undefined,
        description: teamState.description || undefined,
        purpose: teamState.purpose || undefined,
      },
    })
    window.location.href = pageRoutes.workspaces
  }
  catch (err) {
    submitError.value = getErrorMessage(err, 'Не удалось завершить регистрацию')
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="text-[11px] uppercase tracking-[0.18em] text-muted font-medium">
        Шаг {{ step }} из 3
      </p>
      <div class="flex items-center gap-1.5">
        <div
          v-for="i in 3"
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
        icon="i-lucide-alert-circle"
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
      v-else-if="step === 2"
      :state="credentialsState"
      :schema="credentialsSchema"
      class="space-y-6"
      @submit.prevent="goToTeam"
    >
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">Учётные данные</h1>
        <p class="text-sm text-muted leading-relaxed">
          С этим email и паролем будете заходить в Scrumban.
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
      </div>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        :title="submitError"
        icon="i-lucide-alert-circle"
      />
      <div class="grid grid-cols-[auto_1fr] gap-3 pt-2">
        <UButton type="button" variant="ghost" color="neutral" size="xl" @click="back">
          Назад
        </UButton>
        <UButton type="submit" block size="xl" class="font-semibold">
          Дальше
        </UButton>
      </div>
    </UForm>

    <UForm
      v-else-if="step === 3"
      :state="teamState"
      :schema="teamSchema"
      class="space-y-6"
      @submit.prevent="finishOnboarding"
    >
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">О команде</h1>
        <p class="text-sm text-muted leading-relaxed">
          Создадим workspace, в котором будет работать команда.
        </p>
      </div>
      <div class="space-y-4">
        <UFormField label="Название команды" name="name" required>
          <UInput v-model="teamState.name" size="lg" class="w-full" autofocus />
        </UFormField>
        <UFormField
          label="Slug"
          name="slug"
          hint="URL-идентификатор: латиница, цифры и дефисы"
          required
        >
          <UInput
            v-model="teamState.slug"
            size="lg"
            class="w-full"
            @update:model-value="slugTouched = true"
          />
        </UFormField>
        <UFormField label="Индустрия" name="industry">
          <UInput v-model="teamState.industry" size="lg" class="w-full" placeholder="IT, агентство, промышленность..." />
        </UFormField>
        <UFormField label="Чем занимается команда" name="description">
          <UTextarea
            v-model="teamState.description"
            :rows="2"
            class="w-full"
            placeholder="Кратко опишите специализацию"
          />
        </UFormField>
        <UFormField label="Для чего планируете использовать" name="purpose">
          <UTextarea
            v-model="teamState.purpose"
            :rows="2"
            class="w-full"
            placeholder="Например: трекинг задач + аналитика flow"
          />
        </UFormField>
      </div>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        :title="submitError"
        icon="i-lucide-alert-circle"
      />
      <div class="flex gap-3 pt-2">
        <UButton type="button" variant="ghost" color="neutral" size="xl" @click="back">
          Назад
        </UButton>
        <UButton type="submit" :loading="submitting" block size="xl" class="font-semibold">
          Готово
        </UButton>
      </div>
    </UForm>
  </div>
</template>