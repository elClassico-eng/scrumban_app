<script setup lang="ts">
import { pageRoutes } from '~/routing'

const { list, accept } = useMyInvitationsApi()
const router = useRouter()
const toast = useToast()

const invitations = computed(() => list.data.value?.invitations ?? [])
const pendingId = ref<string | null>(null)

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

async function onAccept(invitationId: string, workspaceName: string) {
  pendingId.value = invitationId
  try {
    const res = await accept.mutateAsync(invitationId)
    toast.add({
      title: res.alreadyMember
        ? `Вы уже в ${workspaceName} (роль: ${ROLE_LABEL[res.currentRole] ?? res.currentRole})`
        : `Вы присоединились к ${workspaceName}`,
      description: res.alreadyMember
        ? 'Текущая роль сохранена — изменение ролей делается через members на admin-стороне.'
        : undefined,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 8000,
    })
    await router.push(pageRoutes.boards(res.workspaceId))
  }
  catch (err: unknown) {
    const reason = (err as { data?: { reason?: string } })?.data?.reason
    const message
      = reason === 'email_not_verified'
        ? 'Сначала подтвердите свой email в личном кабинете.'
        : getErrorMessage(err, 'Не удалось принять приглашение')
    toast.add({
      title: message,
      color: 'error',
      icon: 'i-lucide-alert-circle',
      duration: 8000,
    })
  }
  finally {
    pendingId.value = null
  }
}
</script>

<template>
  <section v-if="invitations.length > 0" class="space-y-3">
    <div class="flex items-center gap-2.5">
      <UIcon name="i-lucide-mail-plus" class="size-4 text-accent-600" />
      <h2 class="text-sm font-semibold text-default">Вас приглашают</h2>
      <span class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-accent-50 text-[10px] text-accent-700 font-semibold tabular-nums">
        {{ invitations.length }}
      </span>
    </div>

    <div class="rounded-xl border border-default bg-default divide-y divide-default overflow-hidden">
      <div
        v-for="inv in invitations"
        :key="inv.id"
        class="flex items-center gap-3 px-4 py-3"
      >
        <span class="inline-flex size-9 items-center justify-center rounded-lg bg-accent-50 shrink-0">
          <UIcon name="i-lucide-mail-plus" class="size-4 text-accent-600" />
        </span>

        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-default truncate">
            {{ inv.workspaceName }}
          </p>
          <div class="flex items-center gap-2 mt-1 text-[11.5px] text-muted flex-wrap">
            <span class="inline-flex items-center gap-1">
              <span class="size-1.5 rounded-full" :class="ROLE_DOT_CLASS[inv.role]" />
              {{ ROLE_LABEL[inv.role] }}
            </span>
            <span class="text-dimmed">·</span>
            <span class="inline-flex items-center gap-1">
              <UIcon name="i-lucide-calendar" class="size-3" />
              до {{ shortDate(inv.expiresAt) }}
            </span>
          </div>
        </div>

        <UButton
          size="sm"
          :loading="pendingId === inv.id"
          @click="onAccept(inv.id, inv.workspaceName)"
        >
          Принять
        </UButton>
      </div>
    </div>
  </section>
</template>
