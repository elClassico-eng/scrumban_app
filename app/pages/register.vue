<script setup lang="ts">
import { z } from 'zod'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Регистрация — Scrumban' })

type Step = 1 | 2 | 3
const step = ref<Step>(1)

const userSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Введи имя').max(100),
    lastName: z.string().trim().min(1, 'Введи фамилию').max(100),
    middleName: z.string().trim().max(100).optional(),
    email: z.email('Введи корректный email').max(255),
    password: z.string().min(8, 'Минимум 8 символов').max(128),
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

type UserState = z.infer<typeof userSchema>
type TeamState = z.infer<typeof teamSchema>

const userState = reactive<UserState>({
  firstName: '',
  lastName: '',
  middleName: '',
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

// Auto-derive slug from team name until the user manually edits it.
const slugTouched = ref(false)
watch(() => teamState.name, (name) => {
  if (!slugTouched.value) teamState.slug = slugify(name)
})

const submitting = ref(false)
const submitError = ref<string | null>(null)

function nextFromUser() {
  const parsed = userSchema.safeParse(userState)
  if (!parsed.success) {
    submitError.value = parsed.error.issues[0]?.message ?? 'Заполни все поля'
    return
  }
  submitError.value = null
  step.value = 2
}

function backToUser() {
  submitError.value = null
  step.value = 1
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
    // 1. Create user + auth session.
    await $fetch(apiRoutes.authRegister, {
      method: 'POST',
      body: {
        email: userState.email,
        password: userState.password,
        firstName: userState.firstName,
        lastName: userState.lastName,
        middleName: userState.middleName || undefined,
      },
    })
    // 2. Create workspace. The session cookie from step 1 carries the new user.
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
    // 3. Hard reload — same pattern as login/logout. Wipes all client state
    // and lets the fresh session bootstrap correctly.
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
        Шаг {{ step }} из 2
      </p>
      <div class="flex items-center gap-1.5">
        <div
          class="h-1 flex-1 rounded-full transition-colors"
          :class="step >= 1 ? 'bg-primary' : 'bg-default/40'"
        />
        <div
          class="h-1 flex-1 rounded-full transition-colors"
          :class="step >= 2 ? 'bg-primary' : 'bg-default/40'"
        />
      </div>
    </div>

    <UForm
      v-if="step === 1"
      :state="userState"
      :schema="userSchema"
      class="space-y-6"
      @submit.prevent="nextFromUser"
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
            <UInput v-model="userState.lastName" size="lg" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Имя" name="firstName" required>
            <UInput v-model="userState.firstName" size="lg" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Отчество" name="middleName">
          <UInput v-model="userState.middleName" size="lg" class="w-full" placeholder="Можно пропустить" />
        </UFormField>
        <UFormField label="Email" name="email" required>
          <UInput v-model="userState.email" type="email" autocomplete="email" size="lg" class="w-full" />
        </UFormField>
        <UFormField label="Пароль" name="password" hint="Минимум 8 символов" required>
          <UInput v-model="userState.password" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UFormField label="Повторите пароль" name="confirmPassword" required>
          <UInput v-model="userState.confirmPassword" type="password" autocomplete="new-password" size="lg" class="w-full" />
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
        <UButton type="button" variant="ghost" color="neutral" size="xl" @click="backToUser">
          Назад
        </UButton>
        <UButton type="submit" :loading="submitting" size="xl" class="flex-1 font-semibold">
          Готово
        </UButton>
      </div>
    </UForm>
  </div>
</template>