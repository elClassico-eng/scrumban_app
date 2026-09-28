<script setup lang="ts">
import { pageRoutes } from '~/routing'

const { logout } = useAuthApi()
const { deleteAccount } = useProfileApi()

const password = ref('')
const error = ref<string | null>(null)

async function onDelete() {
  error.value = null
  try {
    await deleteAccount.mutateAsync({ password: password.value })
    window.location.href = pageRoutes.login
  }
  catch (err) {
    error.value = getErrorMessage(err, 'Не удалось удалить аккаунт')
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="surface-soft rounded-2xl p-5">
      <h2 class="mb-1 font-semibold text-default">Выйти из аккаунта</h2>
      <p class="mb-4 text-sm text-muted">Завершает текущий сеанс, данные остаются на месте</p>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-log-out"
        :loading="logout.isPending.value"
        @click="logout.mutate()"
      >
        Выйти
      </UButton>
    </section>

    <section class="surface-soft rounded-2xl p-5" style="border-color: var(--color-error-300)">
      <h2 class="mb-1 font-semibold text-error-600">Удалить аккаунт</h2>
      <p class="mb-4 text-sm text-muted">
        Профиль, членства в командах и личные уведомления исчезнут навсегда. Задачи и комментарии
        останутся в командах, но перестанут быть подписаны вашим именем. Отменить нельзя.
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="sm:w-72"
          placeholder="Текущий пароль"
        />
        <UButton
          color="error"
          :disabled="password.length === 0"
          :loading="deleteAccount.isPending.value"
          @click="onDelete"
        >
          Удалить аккаунт
        </UButton>
      </div>
      <p v-if="error" class="mt-3 text-sm text-error-600">{{ error }}</p>
    </section>
  </div>
</template>
