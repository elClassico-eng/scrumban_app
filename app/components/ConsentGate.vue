<script setup lang="ts">
import { apiRoutes, pageRoutes } from '~/routing'
import { needsConsentGate } from '~/utils/consent-gate'

const route = useRoute()
const toast = useToast()
const { sessionQuery, logout } = useAuthApi()

const open = computed(() => needsConsentGate(sessionQuery.data.value?.user, route.path))
const saving = ref(false)

async function confirm() {
  saving.value = true
  try {
    await $fetch(apiRoutes.meConsent, { method: 'POST' })
    await sessionQuery.refetch()
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить согласие. Попробуйте ещё раз'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal :open="open" :dismissible="false" :ui="{ content: 'max-w-md' }">
    <template #content>
      <div class="space-y-5 p-6">
        <div class="space-y-2">
          <h2 class="text-lg font-semibold">Обновили документы</h2>
          <p class="text-sm text-muted leading-relaxed">
            Чтобы продолжить работу в Такте, подтвердите согласие на обработку персональных данных.
            Перед этим можно прочитать документы – они откроются в новой вкладке.
          </p>
        </div>
        <ul class="space-y-1.5 text-sm">
          <li>
            <a :href="pageRoutes.consent" target="_blank" rel="noopener" class="text-primary hover:underline">Согласие на обработку персональных данных</a>
          </li>
          <li>
            <a :href="pageRoutes.privacy" target="_blank" rel="noopener" class="text-primary hover:underline">Политика обработки персональных данных</a>
          </li>
          <li>
            <a :href="pageRoutes.terms" target="_blank" rel="noopener" class="text-primary hover:underline">Пользовательское соглашение</a>
          </li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <UButton variant="ghost" color="neutral" :loading="logout.isPending.value" @click="logout.mutate()">
            Выйти
          </UButton>
          <UButton :loading="saving" @click="confirm">
            Подтверждаю согласие
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
