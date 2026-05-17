<script setup lang="ts">
const props = defineProps<{ workspaceId: string }>()

const wsId = computed(() => props.workspaceId)
const { list, cancel } = useInvitationsApi(wsId)
const toast = useToast()
const confirm = useConfirm()

const invitations = computed(() => list.data.value?.invitations ?? [])

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function sentRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 7) {
    const d = new Date(iso)
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  }
  if (days >= 2) return `${days} д назад`
  if (days === 1) return 'вчера'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} ч назад`
  const minutes = Math.floor(ms / 60_000)
  if (minutes >= 1) return `${minutes} мин назад`
  return 'только что'
}

async function onCancel(invitationId: string, email: string | null) {
  const target = email ?? 'ссылку'
  const ok = await confirm({
    title: `Отменить приглашение ${email ? 'для ' + email : '(open link)'}?`,
    description: 'Ссылка перестанет работать. Это нельзя отменить.',
    confirmLabel: 'Отменить приглашение',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await cancel.mutateAsync(invitationId)
    toast.add({
      title: `Приглашение для ${target} отменено`,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 3000,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось отменить приглашение'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
      duration: 5000,
    })
  }
}
</script>

<template>
  <section v-if="invitations.length > 0" class="space-y-3 pt-2">
    <div class="flex items-center gap-2.5">
      <UIcon name="i-lucide-mail" class="size-4 text-muted" />
      <h2 class="text-sm font-semibold text-default">Активные приглашения</h2>
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
        <span class="inline-flex size-9 items-center justify-center rounded-lg bg-elevated shrink-0">
          <UIcon
            :name="inv.email ? 'i-lucide-mail' : 'i-lucide-link'"
            class="size-4 text-muted"
          />
        </span>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-medium text-sm text-default truncate font-mono">
              {{ inv.email ?? 'Открытая ссылка' }}
            </p>
            <span
              class="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide"
              :class="daysLeft(inv.expiresAt) <= 2
                ? 'bg-accent-50 text-accent-700'
                : 'bg-elevated text-muted'"
            >
              {{ daysLeft(inv.expiresAt) <= 2 ? `Истекает через ${daysLeft(inv.expiresAt)} д` : 'Ожидает' }}
            </span>
          </div>
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
            <span class="text-dimmed">·</span>
            <span>от <span class="text-default font-medium">{{ inv.createdByEmail }}</span></span>
            <span class="text-dimmed">·</span>
            <span>{{ sentRelative(inv.createdAt) }}</span>
          </div>
        </div>

        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          :loading="cancel.isPending.value"
          title="Отменить приглашение"
          @click="onCancel(inv.id, inv.email)"
        />
      </div>
    </div>
  </section>
</template>
