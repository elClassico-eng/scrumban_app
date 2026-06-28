<script setup lang="ts">
import { z } from 'zod'
import { apiRoutes } from '~/routing'

useHead({ title: 'Личный кабинет — Такт' })

const { me, update } = useProfileApi()
const { list: workspacesList } = useWorkspacesApi()
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

const memberSince = computed(() => {
  const at = me.data.value?.user.createdAt
  if (!at) return null
  return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
})

const workspacesCount = computed(() => workspacesList.data.value?.workspaces.length ?? 0)
const workspacesWord = computed(() => plural(workspacesCount.value, ['команда', 'команды', 'команд']))

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
  <div class="max-w-5xl mx-auto py-8 px-4">
    <div class="space-y-1 mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-default">Личный кабинет (в разработке)</h1>
      <p class="text-sm text-muted">
        Эта информация видна другим участникам ваших workspace'ов.
      </p>
    </div>

    <div v-if="me.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="me.data.value"
      class="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start"
    >
      <div class="space-y-4 lg:sticky lg:top-6">
        <div class="surface-elevated relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-2xl">
          <img
            v-if="state.avatarUrl"
            :src="state.avatarUrl"
            alt=""
            class="absolute inset-0 size-full object-cover"
          >
          <div v-else class="brand-gradient absolute inset-0">
            <div class="absolute inset-0 grid place-items-center">
              <span class="text-6xl font-bold text-white/90">{{ previewInitials }}</span>
            </div>
          </div>

          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/5" />

          <div class="relative p-6 text-center text-white">
            <p class="text-xl font-bold truncate drop-shadow">{{ previewName }}</p>
            <p v-if="state.jobTitle" class="text-sm text-white/85 truncate">{{ state.jobTitle }}</p>
            <p class="text-sm text-white/70 truncate">{{ me.data.value.user.email }}</p>

            <div
              class="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md"
              :class="isVerified
                ? 'bg-emerald-500/85 text-white'
                : 'bg-white/15 text-white/90'"
            >
              <UIcon
                :name="isVerified ? 'i-lucide-badge-check' : 'i-lucide-circle-dashed'"
                class="size-3.5"
              />
              {{ isVerified ? 'Email подтверждён' : 'Email не подтверждён' }}
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 text-left">
              <div class="rounded-xl border border-white/15 bg-white/12 px-3 py-2.5 backdrop-blur-md">
                <p class="text-xl font-bold leading-none">{{ workspacesCount }}</p>
                <p class="mt-1 text-[11px] text-white/70">{{ workspacesWord }}</p>
              </div>
              <div class="rounded-xl border border-white/15 bg-white/12 px-3 py-2.5 backdrop-blur-md">
                <p class="text-sm font-semibold leading-tight">{{ memberSince ?? '—' }}</p>
                <p class="mt-1 text-[11px] text-white/70">на платформе</p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!isVerified"
          class="surface rounded-2xl p-4"
          style="border-color: var(--island-orange-tint-border)"
        >
          <div class="flex items-start gap-2.5">
            <UIcon name="i-lucide-mail-warning" class="size-4 shrink-0 mt-0.5 text-accent-600" />
            <div class="min-w-0 space-y-2">
              <p class="text-xs text-muted leading-relaxed">
                Подтвердите email, чтобы принимать приглашения в чужие workspace'ы. Ссылка действительна 24 часа.
              </p>
              <UButton
                size="xs"
                variant="outline"
                color="neutral"
                :loading="resending"
                :disabled="resendSent"
                @click="resendVerification"
              >
                {{ resendSent ? 'Письмо отправлено' : 'Отправить письмо' }}
              </UButton>
              <p v-if="resendError" class="text-xs text-error-600">{{ resendError }}</p>
            </div>
          </div>
        </div>
        <p v-else-if="verifiedDateLabel" class="px-1 text-xs text-muted">
          Email подтверждён {{ verifiedDateLabel }}
        </p>

        <button
          type="button"
          :disabled="logout.isPending.value"
          class="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-default px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-error-300 hover:bg-error-50 hover:text-error-600 disabled:opacity-60 dark:hover:bg-error-950/40"
          @click="onLogout"
        >
          <UIcon
            :name="logout.isPending.value ? 'i-lucide-loader' : 'i-lucide-log-out'"
            :class="['size-4', logout.isPending.value && 'animate-spin']"
          />
          Выйти из аккаунта
        </button>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <div class="surface rounded-2xl p-6">
          <h2 class="font-semibold text-default mb-4">Имя</h2>
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
        </div>

        <div class="surface rounded-2xl p-6">
          <h2 class="font-semibold text-default mb-4">О себе</h2>
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
        </div>

        <div class="flex justify-end">
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
