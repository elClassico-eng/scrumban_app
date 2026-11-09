<script setup lang="ts">
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'

const { changePassword, sessions, revokeSession, revokeOtherSessions } = useProfileApi()
const toast = useToast()

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
    toast.add({ title: 'Пароль изменён', color: 'success', icon: 'i-hugeicons-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сменить пароль'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
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

function deviceIcon(ua: string | null): string {
  return ua && /iphone|ipad|android|mobile/i.test(ua) ? 'i-hugeicons-smart-phone-01' : 'i-hugeicons-computer'
}

const strength = computed(() => passwordStrength(pwState.newPassword))
const STRENGTH_TONE = ['bg-accented', 'bg-red-500', 'bg-amber-500', 'bg-emerald-400', 'bg-emerald-500'] as const

async function onRevokeSession(id: string) {
  try {
    await revokeSession.mutateAsync(id)
    toast.add({ title: 'Сессия завершена', color: 'success', icon: 'i-hugeicons-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось завершить сессию'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

const otherSessionsCount = computed(
  () => sessions.data.value?.sessions.filter(s => !s.current).length ?? 0,
)

async function onRevokeOthers() {
  try {
    const { revoked } = await revokeOtherSessions.mutateAsync()
    toast.add({
      title: `Завершено сеансов: ${revoked}`,
      color: 'success',
      icon: 'i-hugeicons-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось завершить сеансы'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}
</script>

<template>
  <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
    <SettingsTile title="Пароль">
      <UForm :schema="pwSchema" :state="pwState" class="space-y-4" @submit="onChangePassword">
        <UFormField label="Текущий" name="currentPassword">
          <UInput v-model="pwState.currentPassword" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField label="Новый" name="newPassword">
          <UInput v-model="pwState.newPassword" type="password" autocomplete="new-password" class="w-full" />
          <div class="mt-2 flex gap-1" aria-hidden="true">
            <span
              v-for="i in 4"
              :key="i"
              class="h-1 flex-1 rounded-full transition-colors"
              :class="i <= strength.score ? STRENGTH_TONE[strength.score] : 'bg-accented'"
            />
          </div>
          <p class="mt-1.5 text-xs text-muted">{{ strength.hint }}</p>
        </UFormField>
        <UButton type="submit" :loading="changePassword.isPending.value">Сменить пароль</UButton>
      </UForm>
    </SettingsTile>

    <SettingsTile title="Где вы вошли">
      <template #actions>
        <UButton
          v-if="otherSessionsCount > 0"
          size="xs"
          variant="ghost"
          color="error"
          :loading="revokeOtherSessions.isPending.value"
          @click="onRevokeOthers"
        >
          Выйти на остальных
        </UButton>
      </template>

      <div v-if="sessions.data.value?.sessions.length" class="space-y-2">
        <div
          v-for="s in sessions.data.value.sessions"
          :key="s.id"
          class="flex items-center gap-3 rounded-xl p-3"
          :class="s.current ? 'bg-success/10' : 'bg-zinc-50 dark:bg-elevated/60'"
        >
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-white dark:bg-elevated">
            <UIcon :name="deviceIcon(s.userAgent)" class="size-5 text-toned" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-default">{{ deviceLabel(s.userAgent) }}</p>
            <p class="truncate text-xs text-muted">
              <span v-if="s.current" class="text-success">● это устройство</span>
              <template v-else>активна {{ formatRelativeDate(s.lastSeenAt) }}</template>
              <template v-if="s.ip"> · {{ s.ip }}</template>
            </p>
          </div>
          <UButton
            v-if="!s.current"
            size="xs"
            variant="soft"
            color="neutral"
            :loading="revokeSession.isPending.value"
            @click="onRevokeSession(s.id)"
          >
            Выйти
          </UButton>
        </div>
      </div>
      <p v-else class="text-sm text-muted">Список пуст: сессии записываются со следующего входа.</p>
    </SettingsTile>
  </div>
</template>
