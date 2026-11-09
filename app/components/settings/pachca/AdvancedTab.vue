<script setup lang="ts">
import type { PachcaIntegrationView } from '#shared/types/integrations'

const props = defineProps<{ workspaceId: string, integration: PachcaIntegrationView }>()

const { connect, disconnect } = usePachcaApi(computed(() => props.workspaceId))
const toast = useToast()
const token = ref('')
const signingSecret = ref('')
const confirmDisconnect = ref(false)

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function save() {
  try {
    await connect.mutateAsync({
      ...(token.value.trim() ? { token: token.value.trim() } : {}),
      ...(signingSecret.value.trim() ? { signingSecret: signingSecret.value.trim() } : {}),
    })
    token.value = ''
    signingSecret.value = ''
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
  }
  catch (err) {
    fail(err, 'Не удалось сохранить')
  }
}

async function removeSecret() {
  try {
    await connect.mutateAsync({ signingSecret: null })
  }
  catch (err) {
    fail(err, 'Не удалось сохранить')
  }
}

async function doDisconnect() {
  try {
    await disconnect.mutateAsync()
    confirmDisconnect.value = false
    toast.add({ title: 'Пачка отключена', color: 'neutral' })
  }
  catch (err) {
    fail(err, 'Не удалось отключить')
  }
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: 'Скопировано', color: 'neutral' })
}
</script>

<template>
  <div class="space-y-4">
    <SettingsTile title="Карточки ссылок" description="Ссылка на задачу в чате превратится в карточку со статусом и исполнителем. Работает, только когда Такт доступен из интернета">
      <ol class="mb-4 list-decimal space-y-1 pl-5 text-sm text-toned">
        <li>В карточке бота в Пачке: «Исходящий вебхук» → «Включить», вставь адрес ниже.</li>
        <li>Группа «Ссылки» → unfurl, домен Такта.</li>
        <li>Скопируй Signing secret и вставь сюда.</li>
      </ol>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <UInput :model-value="integration.webhookUrl" readonly class="flex-1" />
          <UButton icon="i-hugeicons-copy-01" color="neutral" variant="soft" aria-label="Скопировать адрес" @click="copy(integration.webhookUrl)" />
        </div>
        <div class="flex items-center gap-2">
          <UInput
            v-model="signingSecret"
            type="password"
            :placeholder="integration.linkPreviews ? 'Секрет сохранён – вставь новый, чтобы заменить' : 'Signing secret'"
            class="flex-1"
          />
          <UButton v-if="integration.linkPreviews" color="neutral" variant="ghost" @click="removeSecret">Убрать</UButton>
        </div>
      </div>
    </SettingsTile>

    <SettingsTile title="Токен бота" :description="`Сейчас: …${integration.tokenHint}`">
      <UInput v-model="token" type="password" placeholder="Новый токен бота" class="w-full" />
    </SettingsTile>

    <div class="flex flex-wrap justify-between gap-2">
      <UButton color="error" variant="ghost" icon="i-hugeicons-unlink-03" @click="confirmDisconnect = true">Отключить Пачку</UButton>
      <UButton :loading="connect.isPending.value" :disabled="!token.trim() && !signingSecret.trim()" @click="save">Сохранить</UButton>
    </div>

    <UModal v-model:open="confirmDisconnect" title="Отключить Пачку?">
      <template #body>
        <p class="text-sm text-muted">
          Привязки участников и ленты досок этого воркспейса удалятся. Бот в Пачке останется, его можно удалить там.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmDisconnect = false">Отмена</UButton>
          <UButton color="error" :loading="disconnect.isPending.value" @click="doDisconnect">Отключить</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
