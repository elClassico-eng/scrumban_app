<script setup lang="ts">
import { INSTANT_NOTIFICATION_TYPES, type InstantNotificationType } from '#shared/types/notification'
import type { PachcaCandidate } from '#shared/types/integrations'

const { current } = useSettingsWorkspace()
const wsId = computed(() => current.value?.id ?? null)
const { state, candidates, requestLink, updateMe, unlinkMe } = usePachcaApi(wsId)
const toast = useToast()

const integration = computed(() => state.data.value?.integration ?? null)
const me = computed(() => state.data.value?.me ?? null)
const picking = ref(false)
const query = ref('')
const list = ref<PachcaCandidate[]>([])
const loading = ref(false)
const sentTo = ref<string | null>(null)

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function search() {
  loading.value = true
  try {
    list.value = (await candidates(query.value)).candidates
  }
  catch (err) {
    fail(err, 'Не удалось получить сотрудников Пачки')
  }
  finally {
    loading.value = false
  }
}

async function open() {
  picking.value = true
  sentTo.value = null
  query.value = ''
  await search()
}

async function pick(c: PachcaCandidate) {
  try {
    await requestLink.mutateAsync(c.id)
    sentTo.value = c.name
  }
  catch (err) {
    fail(err, 'Не удалось отправить сообщение в Пачку')
  }
}

function toggle(type: InstantNotificationType, enabled: boolean) {
  const types = me.value?.instantTypes ?? []
  const next = enabled ? [...new Set([...types, type])] : types.filter(t => t !== type)
  updateMe.mutate({ instantTypes: next }, { onError: err => fail(err, 'Не удалось сохранить') })
}

function toggleDigest(enabled: boolean) {
  updateMe.mutate({ digest: enabled }, { onError: err => fail(err, 'Не удалось сохранить') })
}

watchDebounced(query, () => {
  if (picking.value && !sentTo.value) search()
}, { debounce: 300 })
</script>

<template>
  <div v-if="integration?.status === 'active'">
    <h2 class="mt-6 mb-1 font-semibold text-default">Пачка</h2>
    <p class="mb-4 text-xs text-muted">Уведомления из пространства «{{ current?.name }}» в личку от бота</p>

    <div v-if="!me" class="flex items-center justify-between gap-4 py-2.5">
      <span class="text-sm text-default">Пачка не привязана</span>
      <UButton size="sm" @click="open">Привязать Пачку</UButton>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-4 py-2.5">
        <span class="text-sm text-default">Привязано: {{ me.displayName }}</span>
        <UButton size="sm" color="neutral" variant="ghost" :loading="unlinkMe.isPending.value" @click="unlinkMe.mutate()">Отвязать</UButton>
      </div>
      <div class="divide-y divide-default">
        <div class="flex items-center justify-between gap-4 py-2.5">
          <span class="text-sm text-default">Утренний дайджест в Пачку</span>
          <USwitch :model-value="me.digest" @update:model-value="toggleDigest" />
        </div>
        <div v-for="type in INSTANT_NOTIFICATION_TYPES" :key="type" class="flex items-center justify-between gap-4 py-2.5">
          <span class="text-sm text-default">{{ INSTANT_NOTIFICATION_LABEL[type] }}</span>
          <USwitch :model-value="me.instantTypes.includes(type)" @update:model-value="toggle(type, $event)" />
        </div>
      </div>
    </template>

    <UModal v-model:open="picking" title="Кто вы в Пачке?">
      <template #body>
        <p v-if="sentTo" class="text-sm text-default">
          Бот написал {{ sentTo }} в Пачку. Откройте сообщение и нажмите «Подтвердить в Такте» – ссылка действует 15 минут.
        </p>
        <template v-else>
          <UInput v-model="query" placeholder="Имя или ник в Пачке" icon="i-hugeicons-search-01" class="mb-3 w-full" />
          <p v-if="!loading && !list.length" class="text-sm text-muted">Начните вводить имя.</p>
          <ul class="max-h-72 space-y-1 overflow-y-auto">
            <li v-for="c in list" :key="c.id">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-elevated"
                :disabled="requestLink.isPending.value"
                @click="pick(c)"
              >
                <span class="text-sm text-default">{{ c.name }} <span class="text-muted">@{{ c.nickname }}</span></span>
                <UBadge v-if="c.emailMatches" color="success" variant="soft" size="sm">Ваша почта</UBadge>
              </button>
            </li>
          </ul>
        </template>
      </template>
    </UModal>
  </div>
</template>
