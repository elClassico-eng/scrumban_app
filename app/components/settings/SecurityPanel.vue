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

const otherSessionsCount = computed(
  () => sessions.data.value?.sessions.filter(s => !s.current).length ?? 0,
)

async function onRevokeOthers() {
  try {
    const { revoked } = await revokeOtherSessions.mutateAsync()
    toast.add({
      title: `Завершено сеансов: ${revoked}`,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось завершить сеансы'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <div class="space-y-4">
    <UForm :schema="pwSchema" :state="pwState" class="surface-soft rounded-2xl p-5" @submit="onChangePassword">
      <h2 class="mb-4 font-semibold text-default">Смена пароля</h2>
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
      <h2 class="mb-1 font-semibold text-default">Активные сессии</h2>
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

      <div v-if="otherSessionsCount > 0" class="mt-4 border-t border-default pt-4">
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          :loading="revokeOtherSessions.isPending.value"
          @click="onRevokeOthers"
        >
          Завершить все остальные сеансы
        </UButton>
      </div>
    </section>
  </div>
</template>
