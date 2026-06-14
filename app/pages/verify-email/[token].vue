<script setup lang="ts">
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth', cardMaxWidth: 'lg:max-w-md' })
useHead({ title: 'Подтверждение email — Scrumban' })

type State =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'expired' }
  | { kind: 'already_used' }
  | { kind: 'invalid' }
  | { kind: 'error', message: string }

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
const state = ref<State>({ kind: 'loading' })

const { sessionQuery } = useAuthApi()
const authenticated = computed(() => !!sessionQuery.data.value?.user)

onMounted(async () => {
  try {
    await $fetch(apiRoutes.authVerifyEmail(token.value), { method: 'POST' })
    state.value = { kind: 'success' }
    await sessionQuery.refetch()
  }
  catch (err: unknown) {
    const reason = (err as { data?: { reason?: string } })?.data?.reason
    if (reason === 'expired') state.value = { kind: 'expired' }
    else if (reason === 'already_used') state.value = { kind: 'already_used' }
    else if (reason === 'not_found') state.value = { kind: 'invalid' }
    else state.value = { kind: 'error', message: getErrorMessage(err, 'Не удалось подтвердить email') }
  }
})

const ctaTarget = computed(() => (authenticated.value ? pageRoutes.workspaces : pageRoutes.login))
const ctaLabel = computed(() => (authenticated.value ? 'В рабочее пространство' : 'Войти'))
</script>

<template>
  <div class="space-y-6">
    <template v-if="state.kind === 'loading'">
      <div class="flex flex-col items-center gap-4 py-6">
        <UIcon name="i-lucide-loader" class="size-8 animate-spin text-primary" />
        <p class="text-sm text-muted">Подтверждаем email...</p>
      </div>
    </template>

    <template v-else-if="state.kind === 'success'">
      <div class="space-y-3 text-center">
        <UIcon name="i-lucide-check-circle-2" class="size-12 text-success-500 mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Email подтверждён</h1>
        <p class="text-sm text-muted">Готово. Можно работать.</p>
      </div>
      <UButton :to="ctaTarget" block size="xl" class="font-semibold">
        {{ ctaLabel }}
      </UButton>
    </template>

    <template v-else-if="state.kind === 'already_used'">
      <div class="space-y-3 text-center">
        <UIcon name="i-lucide-info" class="size-12 text-muted mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Уже подтверждено</h1>
        <p class="text-sm text-muted">Этот email уже подтверждён ранее.</p>
      </div>
      <UButton :to="ctaTarget" block size="xl" class="font-semibold">
        {{ ctaLabel }}
      </UButton>
    </template>

    <template v-else-if="state.kind === 'expired'">
      <div class="space-y-3 text-center">
        <UIcon name="i-lucide-clock" class="size-12 text-warning-500 mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Ссылка устарела</h1>
        <p class="text-sm text-muted">
          Срок действия ссылки истёк. Войдите и запросите новое письмо.
        </p>
      </div>
      <UButton :to="pageRoutes.login" block size="xl" class="font-semibold">
        Войти
      </UButton>
    </template>

    <template v-else-if="state.kind === 'invalid'">
      <div class="space-y-3 text-center">
        <UIcon name="i-lucide-x-circle" class="size-12 text-error-500 mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Ссылка недействительна</h1>
        <p class="text-sm text-muted">Проверьте, что вы открыли последнюю ссылку из письма.</p>
      </div>
      <UButton :to="pageRoutes.login" block size="xl" variant="ghost" color="neutral">
        Войти
      </UButton>
    </template>

    <template v-else>
      <UAlert
        color="error"
        variant="soft"
        :title="state.message"
        icon="i-lucide-alert-circle"
      />
      <UButton :to="pageRoutes.login" block size="xl" variant="ghost" color="neutral">
        Назад ко входу
      </UButton>
    </template>
  </div>
</template>
