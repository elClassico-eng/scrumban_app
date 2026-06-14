<script setup lang="ts">
import type { Role } from '#shared/types/domain'
import { apiRoutes, pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth', cardMaxWidth: 'lg:max-w-md' })
useHead({ title: 'Приглашение в workspace — Scrumban' })

type InspectResponse =
  | { valid: true, workspaceName: string, role: string, emailBound: string | null }
  | { valid: false, reason: 'not_found' | 'expired' | 'already_used' }

type InviteInfo = { workspaceName: string, role: Role, emailBound: string | null }

type State =
  | { kind: 'loading' }
  | { kind: 'invalid', reason: 'not_found' | 'expired' | 'already_used' }
  | { kind: 'ready' }
  | { kind: 'accepting' }
  | { kind: 'email_not_verified' }
  | { kind: 'error', message: string }

const route = useRoute()
const router = useRouter()
const toast = useToast()
const token = computed(() => String(route.params.token ?? ''))
const inviteHref = computed(() => pageRoutes.invite(token.value))

const state = ref<State>({ kind: 'loading' })
const invite = ref<InviteInfo | null>(null)

const { sessionQuery } = useAuthApi()
const authenticated = computed(() => !!sessionQuery.data.value?.user)
const userEmail = computed(() => sessionQuery.data.value?.user?.email ?? null)

const emailMismatch = computed(() => {
  const info = invite.value
  if (!info?.emailBound || !userEmail.value) return false
  return info.emailBound.toLowerCase() !== userEmail.value.toLowerCase()
})

onMounted(async () => {
  try {
    const res = await $fetch<InspectResponse>(apiRoutes.invitationInspect(token.value))
    if (!res.valid) {
      state.value = { kind: 'invalid', reason: res.reason }
      return
    }
    invite.value = {
      workspaceName: res.workspaceName,
      role: res.role as Role,
      emailBound: res.emailBound,
    }
    state.value = { kind: 'ready' }
  }
  catch (err) {
    state.value = { kind: 'error', message: getErrorMessage(err, 'Не удалось загрузить приглашение') }
  }
})

async function accept() {
  if (state.value.kind !== 'ready') return
  const wsName = invite.value?.workspaceName ?? ''
  state.value = { kind: 'accepting' }
  try {
    const res = await $fetch<{
      workspaceId: string
      alreadyMember: boolean
      currentRole: string
    }>(apiRoutes.invitationAccept(token.value), { method: 'POST' })
    await sessionQuery.refetch()
    toast.add({
      title: res.alreadyMember
        ? `Вы уже в ${wsName} (роль: ${ROLE_LABEL[res.currentRole as Role] ?? res.currentRole})`
        : `Вы присоединились к ${wsName}`,
      description: res.alreadyMember
        ? 'Текущая роль сохранена — изменение ролей делается через members.'
        : undefined,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 8000,
    })
    await router.push(pageRoutes.boards(res.workspaceId))
  }
  catch (err: unknown) {
    const reason = (err as { data?: { reason?: string } })?.data?.reason
    if (reason === 'expired') state.value = { kind: 'invalid', reason: 'expired' }
    else if (reason === 'already_used') state.value = { kind: 'invalid', reason: 'already_used' }
    else if (reason === 'email_not_verified') state.value = { kind: 'email_not_verified' }
    else if (reason === 'email_mismatch') {
      state.value = { kind: 'error', message: 'Приглашение выписано на другой email.' }
    }
    else state.value = { kind: 'error', message: getErrorMessage(err, 'Не удалось принять приглашение') }
  }
}

const loginWithNext = computed(() => ({
  path: pageRoutes.login,
  query: { next: inviteHref.value },
}))
const registerWithNext = computed(() => ({
  path: pageRoutes.register,
  query: { next: inviteHref.value },
}))
</script>

<template>
  <div class="space-y-6">
    <template v-if="state.kind === 'loading'">
      <div class="flex flex-col items-center gap-3 py-10">
        <UIcon name="i-lucide-loader" class="size-7 animate-spin text-primary" />
        <p class="text-sm text-muted">Загружаем приглашение...</p>
      </div>
    </template>

    <template v-else-if="state.kind === 'invalid'">
      <div class="space-y-3 text-center">
        <UIcon
          :name="state.reason === 'expired' ? 'i-lucide-clock' : 'i-lucide-x-circle'"
          :class="[
            'size-12 mx-auto',
            state.reason === 'expired' ? 'text-warning-500' : 'text-error-500',
          ]"
        />
        <h1 class="text-2xl font-bold tracking-tight">
          {{
            state.reason === 'expired' ? 'Приглашение истекло'
            : state.reason === 'already_used' ? 'Приглашение уже использовано'
            : 'Приглашение недействительно'
          }}
        </h1>
        <p class="text-sm text-muted">
          Попросите администратора workspace выслать новое приглашение.
        </p>
      </div>
      <UButton :to="pageRoutes.workspaces" block size="xl" variant="ghost" color="neutral">
        В мои workspace
      </UButton>
    </template>

    <template v-else-if="state.kind === 'ready' || state.kind === 'accepting'">
      <div class="space-y-2 text-center">
        <UIcon name="i-lucide-users" class="size-10 text-primary mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">
          Приглашение в workspace
        </h1>
        <p class="text-sm text-muted leading-relaxed">
          Вас приглашают присоединиться к
          <span class="font-semibold text-default">{{ invite?.workspaceName }}</span>
          в роли
          <span class="font-medium text-default">{{ invite ? ROLE_LABEL[invite.role] : '' }}</span>.
        </p>
      </div>

      <div v-if="invite?.emailBound" class="text-xs text-center text-muted">
        Приглашение выписано на <span class="text-default font-medium">{{ invite.emailBound }}</span>
      </div>

      <div v-if="!authenticated" class="space-y-3 pt-2">
        <UButton :to="loginWithNext" block size="xl" class="font-semibold">
          Войти и принять
        </UButton>
        <UButton :to="registerWithNext" block size="xl" variant="ghost" color="neutral">
          Нет аккаунта — зарегистрироваться
        </UButton>
      </div>

      <div v-else-if="emailMismatch" class="space-y-3 pt-2">
        <div class="rounded-xl border border-default bg-elevated/60 p-4 space-y-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="size-4 text-muted" />
            <p class="text-sm font-medium text-default">Не тот аккаунт</p>
          </div>
          <p class="text-sm text-muted leading-relaxed">
            Войдите как
            <span class="text-default font-medium">{{ invite?.emailBound }}</span>,
            чтобы принять это приглашение. Сейчас вы вошли как
            <span class="text-default font-medium">{{ userEmail }}</span>.
          </p>
        </div>
        <UButton :to="loginWithNext" block size="xl" variant="outline" color="neutral">
          Сменить аккаунт
        </UButton>
      </div>

      <div v-else class="pt-2">
        <UButton
          block
          size="xl"
          class="font-semibold"
          :loading="state.kind === 'accepting'"
          @click="accept"
        >
          Принять приглашение
        </UButton>
      </div>
    </template>

    <template v-else-if="state.kind === 'email_not_verified'">
      <div class="space-y-3 text-center">
        <UIcon name="i-lucide-mail-warning" class="size-12 text-muted mx-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Сначала подтвердите email</h1>
        <p class="text-sm text-muted leading-relaxed">
          Приглашения с email-привязкой можно принять только после подтверждения собственного email — это защита от перехвата приглашений.
        </p>
      </div>
      <div class="flex flex-col gap-3 pt-2">
        <UButton :to="pageRoutes.me" block size="xl" class="font-semibold">
          В личный кабинет
        </UButton>
      </div>
    </template>

    <template v-else>
      <UAlert
        color="error"
        variant="soft"
        :title="state.message"
        icon="i-lucide-alert-circle"
      />
      <UButton :to="pageRoutes.workspaces" block size="xl" variant="ghost" color="neutral">
        В мои workspace
      </UButton>
    </template>
  </div>
</template>
