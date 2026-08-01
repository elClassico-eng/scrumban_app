<script setup lang="ts">
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { apiRoutes } from '~/routing'

useHead({ title: 'Личный кабинет — Такт' })

const { me, update, changePassword, sessions, revokeSession } = useProfileApi()
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

async function save(fields: Partial<State>, okTitle: string) {
  const body = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
  )
  try {
    await update.mutateAsync(body)
    toast.add({ title: okTitle, color: 'success', icon: 'i-lucide-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const saveName = () => save(
  { firstName: state.firstName, lastName: state.lastName, middleName: state.middleName },
  'Имя обновлено',
)
const saveAbout = () => save(
  { jobTitle: state.jobTitle, bio: state.bio, avatarUrl: state.avatarUrl },
  'Профиль обновлён',
)

const pwState = reactive({ currentPassword: '', newPassword: '' })
const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: passwordSchema,
})

async function onChangePassword() {
  try {
    await changePassword.mutateAsync({ ...pwState })
    pwState.currentPassword = ''
    pwState.newPassword = ''
    toast.add({ title: 'Пароль изменён', color: 'success', icon: 'i-lucide-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сменить пароль'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const prefs = computed(() => me.data.value?.user.notificationPrefs ?? {})

function toggleNotification(type: string, enabled: boolean) {
  update.mutate(
    { notificationPrefs: { ...prefs.value, [type]: enabled } },
    {
      onError: err => toast.add({
        title: getErrorMessage(err, 'Не удалось сохранить'),
        color: 'error',
        icon: 'i-lucide-alert-circle',
      }),
    },
  )
}

function deviceLabel(ua: string | null): string {
  if (!ua) return 'Неизвестное устройство'
  const browser = /firefox/i.test(ua) ? 'Firefox'
    : /edg/i.test(ua) ? 'Edge'
      : /chrome/i.test(ua) ? 'Chrome'
        : /safari/i.test(ua) ? 'Safari' : 'Браузер'
  const os = /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'macOS'
      : /android/i.test(ua) ? 'Android'
        : /iphone|ipad|ios/i.test(ua) ? 'iOS'
          : /linux/i.test(ua) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}

async function onRevokeSession(id: string) {
  try {
    await revokeSession.mutateAsync(id)
    toast.add({ title: 'Сессия завершена', color: 'success', icon: 'i-lucide-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось завершить сессию'),
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
  <div class="space-y-4 py-2">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-default sm:text-[28px]">Личный кабинет</h1>
      <p class="text-sm text-muted">
        Эта информация видна другим участникам ваших workspace'ов.
      </p>
    </div>

    <div v-if="me.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="me.data.value"
      class="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12"
    >
      <div class="space-y-4 lg:col-span-4 lg:sticky lg:top-6">
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
          class="surface-soft rounded-2xl p-4"
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

      <div class="space-y-4 lg:col-span-8">
        <UForm :schema="schema" :state="state" class="surface-soft rounded-2xl p-5" @submit="saveName">
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
          <div class="mt-4 flex justify-end">
            <UButton type="submit" size="sm" :loading="update.isPending.value">Сохранить</UButton>
          </div>
        </UForm>

        <UForm :schema="schema" :state="state" class="surface-soft rounded-2xl p-5" @submit="saveAbout">
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
          <div class="mt-4 flex justify-end">
            <UButton type="submit" size="sm" :loading="update.isPending.value">Сохранить</UButton>
          </div>
        </UForm>

        <UForm :schema="pwSchema" :state="pwState" class="surface-soft rounded-2xl p-5" @submit="onChangePassword">
          <h2 class="font-semibold text-default mb-4">Смена пароля</h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Текущий пароль" name="currentPassword">
              <UInput v-model="pwState.currentPassword" type="password" autocomplete="current-password" class="w-full" />
            </UFormField>
            <UFormField label="Новый пароль" name="newPassword" description="Минимум 10 символов, буква и цифра">
              <UInput v-model="pwState.newPassword" type="password" autocomplete="new-password" class="w-full" />
            </UFormField>
          </div>
          <div class="mt-4 flex justify-end">
            <UButton type="submit" size="sm" :loading="changePassword.isPending.value">Сменить пароль</UButton>
          </div>
        </UForm>

        <section class="surface-soft rounded-2xl p-5">
          <h2 class="font-semibold text-default mb-1">Уведомления</h2>
          <p class="mb-4 text-xs text-muted">Какие события присылать в колокольчик</p>
          <div class="divide-y divide-default">
            <div
              v-for="(label, type) in NOTIFICATION_TYPE_LABEL"
              :key="type"
              class="flex items-center justify-between gap-4 py-2.5"
            >
              <span class="text-sm text-default">{{ label }}</span>
              <USwitch
                :model-value="prefs[type] !== false"
                @update:model-value="toggleNotification(type, $event)"
              />
            </div>
          </div>
        </section>

        <section class="surface-soft rounded-2xl p-5">
          <h2 class="font-semibold text-default mb-1">Активные сессии</h2>
          <p class="mb-4 text-xs text-muted">Устройства, с которых выполнен вход в аккаунт</p>
          <div v-if="sessions.data.value?.sessions.length" class="divide-y divide-default">
            <div
              v-for="s in sessions.data.value.sessions"
              :key="s.id"
              class="flex items-center justify-between gap-4 py-2.5"
            >
              <div class="min-w-0">
                <p class="flex items-center gap-2 text-sm text-default">
                  <UIcon name="i-lucide-monitor-smartphone" class="size-4 shrink-0 text-muted" />
                  <span class="truncate">{{ deviceLabel(s.userAgent) }}</span>
                  <span
                    v-if="s.current"
                    class="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600 dark:bg-success-950/40"
                  >текущая</span>
                </p>
                <p class="mt-0.5 text-xs text-muted">
                  {{ s.ip ?? '—' }} · активна {{ formatRelativeDate(s.lastSeenAt) }}
                </p>
              </div>
              <UButton
                v-if="!s.current"
                size="xs"
                variant="ghost"
                color="error"
                :loading="revokeSession.isPending.value"
                @click="onRevokeSession(s.id)"
              >
                Завершить
              </UButton>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            Список пуст: сессии записываются начиная со следующего входа в аккаунт.
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
