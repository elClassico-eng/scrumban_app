<script setup lang="ts">
import type { PachcaInviteResult, PachcaStateResponse } from '#shared/types/integrations'

const props = defineProps<{ workspaceId: string, state: PachcaStateResponse }>()

const { inviteAll } = usePachcaApi(computed(() => props.workspaceId))
const toast = useToast()
const preview = ref<PachcaInviteResult | null>(null)

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function find() {
  try {
    preview.value = await inviteAll.mutateAsync(true)
  }
  catch (err) {
    fail(err, 'Не удалось найти совпадения')
  }
}

async function send() {
  try {
    const res = await inviteAll.mutateAsync(false)
    preview.value = null
    toast.add({ title: `Отправлено приглашений: ${res.sent}`, color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
  }
  catch (err) {
    fail(err, 'Не удалось отправить приглашения')
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsPachcaLinkBlock />

    <SettingsTile v-if="state.canManage" title="Команда в Пачке" :description="`Привязано ${state.linkedMembers} из ${state.members}`">
      <div class="mb-4 h-2 overflow-hidden rounded-full bg-accented">
        <span class="block h-full bg-accent-500" :style="{ width: `${state.members ? state.linkedMembers / state.members * 100 : 0}%` }" />
      </div>
      <p class="text-sm text-muted">
        Бот напишет каждому, чья почта в Пачке совпала с почтой участника воркспейса, и попросит подтвердить привязку в Такте.
      </p>
      <p v-if="!state.integration?.emailsVisible" class="mt-2 text-sm text-warning">
        Включи показ персональных данных в настройках пространства Пачки, иначе бот не видит почты.
      </p>
      <template v-else>
        <p v-if="preview" class="mt-3 text-sm text-default">
          Совпало по почте: {{ preview.matched }} из {{ preview.members }}, уже привязаны: {{ preview.alreadyLinked }}
        </p>
        <div class="mt-3 flex gap-2">
          <UButton v-if="!preview" variant="soft" color="neutral" :loading="inviteAll.isPending.value" @click="find">Найти совпадения</UButton>
          <UButton
            v-else
            :disabled="preview.matched - preview.alreadyLinked === 0"
            :loading="inviteAll.isPending.value"
            @click="send"
          >
            Предложить привязаться
          </UButton>
        </div>
      </template>
    </SettingsTile>
  </div>
</template>
