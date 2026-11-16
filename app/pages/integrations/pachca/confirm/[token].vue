<script setup lang="ts">
import { apiRoutes, pageRoutes } from '~/routing'
import type { PachcaLinkInspect } from '#shared/types/integrations'

definePageMeta({ layout: 'auth', colorMode: 'light', cardMaxWidth: 'lg:max-w-md' })
useHead({ title: 'Привязка Пачки – Такт' })

const REASONS: Record<'not_found' | 'expired' | 'used' | 'other_user', string> = {
  not_found: 'Ссылка не найдена.',
  expired: 'Ссылка устарела. Запросите привязку заново в настройках уведомлений.',
  used: 'Ссылка уже использована.',
  other_user: 'Эту ссылку должен подтвердить другой пользователь Такта. Войдите под своим аккаунтом.',
}

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
const toast = useToast()
const info = ref<PachcaLinkInspect | null>(null)
const done = ref(false)
const pending = ref(false)

onMounted(async () => {
  info.value = await $fetch<PachcaLinkInspect>(apiRoutes.pachcaLinkToken(token.value))
    .catch(() => ({ valid: false, reason: 'not_found' }) as const)
})

async function confirm() {
  pending.value = true
  try {
    await $fetch(apiRoutes.pachcaLinkToken(token.value), { method: 'POST' })
    done.value = true
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось привязать'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-default">Привязка Пачки</h1>
    <p v-if="!info" class="text-sm text-muted">Проверяем ссылку…</p>
    <template v-else-if="done">
      <p class="text-sm text-default">Готово. Уведомления будут приходить в Пачку.</p>
      <UButton :to="pageRoutes.settings('notifications')" block>Настроить события</UButton>
    </template>
    <template v-else-if="info.valid">
      <p class="text-sm text-default">
        Привязать сотрудника Пачки <b>{{ info.pachcaName }}</b> к вашему аккаунту в пространстве «{{ info.workspaceName }}»?
      </p>
      <UButton :loading="pending" block @click="confirm">Привязать</UButton>
    </template>
    <p v-else class="text-sm text-muted">{{ REASONS[info.reason] }}</p>
  </div>
</template>
