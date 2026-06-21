<script setup lang="ts">
import { z } from 'zod'
import { apiRoutes } from '~/routing'

useHead({ title: 'Личный кабинет — Scrumban' })

const { me, update } = useProfileApi()
const { logout } = useAuthApi()
const toast = useToast()

function onLogout() {
  logout.mutate()
}

const verifiedAt = computed(() => me.data.value?.user.emailVerifiedAt ?? null)
const isVerified = computed(() => verifiedAt.value !== null)
const verifiedDateLabel = computed(() => {
  if (!verifiedAt.value) return null
  return new Date(verifiedAt.value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const resending = ref(false)
const resendSent = ref(false)
const resendError = ref<string | null>(null)

async function resendVerification() {
  if (resending.value) return
  resending.value = true
  resendError.value = null
  try {
    await $fetch(apiRoutes.authResendVerification, { method: 'POST' })
    resendSent.value = true
    toast.add({
      title: 'Письмо отправлено',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 2000,
    })
  }
  catch (err) {
    resendError.value = getErrorMessage(err, 'Не удалось отправить письмо')
  }
  finally {
    resending.value = false
  }
}

const schema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  middleName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(150),
  bio: z.string().max(5000),
  avatarUrl: z.union([z.url().max(2000), z.literal('')]),
})

type State = z.infer<typeof schema>
const state = reactive<State>({
  firstName: '',
  lastName: '',
  middleName: '',
  jobTitle: '',
  bio: '',
  avatarUrl: '',
})

watch(
  () => me.data.value?.user,
  (u) => {
    if (!u) return
    state.firstName = u.firstName ?? ''
    state.lastName = u.lastName ?? ''
    state.middleName = u.middleName ?? ''
    state.jobTitle = u.jobTitle ?? ''
    state.bio = u.bio ?? ''
    state.avatarUrl = u.avatarUrl ?? ''
  },
  { immediate: true },
)

async function onSubmit() {
  try {
    await update.mutateAsync({
      firstName: state.firstName.trim() || null,
      lastName: state.lastName.trim() || null,
      middleName: state.middleName.trim() || null,
      jobTitle: state.jobTitle.trim() || null,
      bio: state.bio.trim() || null,
      avatarUrl: state.avatarUrl.trim() || null,
    })
    toast.add({
      title: 'Профиль обновлён',
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

const previewName = computed(() => displayName({
  firstName: state.firstName,
  lastName: state.lastName,
  email: me.data.value?.user.email ?? '',
}))
const previewInitials = computed(() => initials({
  firstName: state.firstName,
  lastName: state.lastName,
  email: me.data.value?.user.email ?? '',
}))
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 space-y-8">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">Личный кабинет</h1>
      <p class="text-sm text-muted">
        Эта информация видна другим участникам ваших workspace'ов.
      </p>
    </div>

    <div v-if="me.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UForm
      v-else-if="me.data.value"
      :schema="schema"
      :state="state"
      class="space-y-6"
      @submit="onSubmit"
    >
      <UCard>
        <div class="flex items-start gap-4 sm:gap-6">
          <div class="size-20 rounded-full bg-primary/10 text-primary text-2xl font-semibold flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="state.avatarUrl"
              :src="state.avatarUrl"
              alt=""
              class="size-full object-cover"
            >
            <span v-else>{{ previewInitials }}</span>
          </div>
          <div class="flex-1 min-w-0 space-y-1">
            <p class="text-xl font-semibold truncate">{{ previewName }}</p>
            <p class="text-sm text-muted truncate">{{ me.data.value.user.email }}</p>
            <p v-if="state.jobTitle" class="text-sm text-muted truncate">{{ state.jobTitle }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Email</h2>
        </template>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-medium text-default truncate">
              {{ me.data.value.user.email }}
            </p>
            <div class="flex items-center gap-1.5">
              <UIcon
                :name="isVerified ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'"
                :class="[
                  'size-3.5 shrink-0',
                  isVerified ? 'text-success-600' : 'text-muted',
                ]"
              />
              <span
                class="text-xs"
                :class="isVerified ? 'text-success-700' : 'text-muted'"
              >
                {{ isVerified ? `Подтверждён ${verifiedDateLabel}` : 'Не подтверждён' }}
              </span>
            </div>
          </div>
          <UButton
            v-if="!isVerified"
            size="sm"
            variant="outline"
            color="neutral"
            :loading="resending"
            :disabled="resendSent"
            @click="resendVerification"
          >
            {{ resendSent ? 'Письмо отправлено' : 'Отправить письмо' }}
          </UButton>
        </div>
        <p v-if="!isVerified && !resendSent" class="text-xs text-muted mt-3">
          Письмо со ссылкой действительно 24 часа. Подтверждение нужно, чтобы принимать приглашения в чужие workspace'ы.
        </p>
        <p v-if="resendError" class="text-xs text-error-600 mt-3">
          {{ resendError }}
        </p>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Имя</h2>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UFormField label="Фамилия" name="lastName">
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
          <UFormField label="Имя" name="firstName">
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField label="Отчество" name="middleName">
            <UInput v-model="state.middleName" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">О себе</h2>
        </template>
        <div class="space-y-4">
          <UFormField label="Должность" name="jobTitle">
            <UInput
              v-model="state.jobTitle"
              class="w-full"
              placeholder="Например: Senior Frontend Developer"
            />
          </UFormField>
          <UFormField
            label="Аватар (URL)"
            name="avatarUrl"
            description="Ссылка на изображение — Gravatar, Telegram-аватарка или любой публичный URL"
          >
            <UInput
              v-model="state.avatarUrl"
              class="w-full"
              placeholder="https://..."
            />
          </UFormField>
          <UFormField label="Краткое описание" name="bio">
            <UTextarea
              v-model="state.bio"
              :rows="4"
              class="w-full"
              placeholder="Чем занимаетесь, на чём специализируетесь"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton type="submit" :loading="update.isPending.value">
          Сохранить
        </UButton>
      </div>
    </UForm>

    <UCard v-if="me.data.value">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="min-w-0 space-y-1">
          <h2 class="font-semibold">Аккаунт</h2>
          <p class="text-sm text-muted">
            Завершить сессию на этом устройстве — вы вернётесь на страницу входа.
          </p>
        </div>
        <UButton
          icon="i-lucide-log-out"
          color="error"
          variant="soft"
          class="shrink-0"
          :loading="logout.isPending.value"
          @click="onLogout"
        >
          Выйти из аккаунта
        </UButton>
      </div>
    </UCard>
  </div>
</template>