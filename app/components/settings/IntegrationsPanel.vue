<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { PachcaInviteResult } from '#shared/types/integrations'

const BOARD_LINKS_LIMIT = 4

const { current } = useCurrentWorkspace()
const wsId = computed(() => current.value?.id ?? null)
const { state, connect, disconnect, inviteAll } = usePachcaApi(wsId)
const { list: boardsList } = useBoardsApi(computed(() => wsId.value ?? ''))
const toast = useToast()

const data = computed(() => state.data.value)
const integration = computed(() => data.value?.integration ?? null)
const boards = computed(() => (boardsList.data.value?.boards ?? []).slice(0, BOARD_LINKS_LIMIT))
const advanced = ref(false)
const token = ref('')
const signingSecret = ref('')
const confirmDisconnect = ref(false)
const invitePreview = ref<PachcaInviteResult | null>(null)

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
    fail(err, 'Не удалось подключить Пачку')
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
    invitePreview.value = null
    toast.add({ title: 'Пачка отключена', color: 'neutral' })
  }
  catch (err) {
    fail(err, 'Не удалось отключить')
  }
}

async function previewInvite() {
  try {
    invitePreview.value = await inviteAll.mutateAsync(true)
  }
  catch (err) {
    fail(err, 'Не удалось найти совпадения')
  }
}

async function sendInvite() {
  try {
    const res = await inviteAll.mutateAsync(false)
    invitePreview.value = null
    toast.add({ title: `Отправлено приглашений: ${res.sent}`, color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
  }
  catch (err) {
    fail(err, 'Не удалось отправить приглашения')
  }
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: 'Скопировано', color: 'neutral' })
}
</script>

<template>
  <section class="surface-soft rounded-2xl p-5">
    <h2 class="mb-1 font-semibold text-default">Пачка</h2>
    <p class="mb-4 text-xs text-muted">
      Личные уведомления, лента доски в чат и карточки ссылок на задачи. Данные остаются в России.
    </p>

    <p v-if="data && !data.available" class="rounded-xl bg-warning/10 p-3 text-sm text-warning">
      На сервере не задан ключ шифрования интеграций (INTEGRATIONS_SECRET). Подключение пока недоступно.
    </p>

    <template v-else-if="integration">
      <div class="flex items-center justify-between gap-4 rounded-xl bg-elevated/50 p-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-default">Бот «{{ integration.botName }}» · токен …{{ integration.tokenHint }}</p>
          <p v-if="integration.status === 'error'" class="text-xs text-error">{{ integration.lastError }}</p>
          <p v-else class="text-xs text-muted">
            Работает{{ integration.emailsVisible ? '' : ' · почты сотрудников боту не видны' }}
          </p>
        </div>
        <UBadge :color="integration.status === 'active' ? 'success' : 'error'" variant="soft">
          {{ integration.status === 'active' ? 'Подключена' : 'Ошибка' }}
        </UBadge>
      </div>

      <h3 class="mt-5 mb-3 text-sm font-semibold text-default">Что дальше</h3>
      <ol class="space-y-3">
        <li class="flex gap-3">
          <UIcon
            :name="data?.me ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-circle'"
            class="mt-0.5 size-5 shrink-0"
            :class="data?.me ? 'text-success' : 'text-muted'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-default">Привяжите свою Пачку</p>
            <p class="text-xs text-muted">
              Упоминания, назначения и ответы будут приходить в личку от бота. Каждый участник привязывается сам.
            </p>
            <p v-if="data?.me" class="mt-1 text-xs text-success">Привязано: {{ data.me.displayName }}</p>
            <UButton v-else class="mt-2" size="sm" :to="pageRoutes.settings('notifications')">Привязать себя</UButton>
          </div>
        </li>

        <li v-if="data?.canManage" class="flex gap-3">
          <UIcon name="i-hugeicons-circle" class="mt-0.5 size-5 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-default">Включите ленту доски в чат команды</p>
            <p class="text-xs text-muted">
              Добавьте бота «{{ integration.botName }}» в нужный чат в Пачке, затем выберите доску: откроются её настройки на разделе «Лента в Пачку».
            </p>
            <div v-if="boards.length" class="mt-2 flex flex-wrap gap-2">
              <UButton
                v-for="b in boards"
                :key="b.id"
                size="sm"
                color="neutral"
                variant="soft"
                :to="{ path: pageRoutes.board(wsId!, b.id), query: { settings: 'feed' } }"
              >
                {{ b.name }}
              </UButton>
            </div>
            <p v-else class="mt-1 text-xs text-muted">Сначала создайте доску.</p>
          </div>
        </li>

        <li v-if="data?.canManage" class="flex gap-3">
          <UIcon name="i-hugeicons-circle" class="mt-0.5 size-5 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-default">Пригласите команду</p>
            <p class="text-xs text-muted">
              Бот напишет каждому, чья почта в Пачке совпала с почтой участника пространства, и попросит подтвердить привязку в Такте.
            </p>
            <p v-if="!integration.emailsVisible" class="mt-1 text-xs text-muted">
              Включите показ персональных данных в настройках пространства Пачки, иначе бот не видит почты.
            </p>
            <template v-else>
              <p v-if="invitePreview" class="mt-1 text-xs text-default">
                Совпало по почте: {{ invitePreview.matched }} из {{ invitePreview.members }}, уже привязаны: {{ invitePreview.alreadyLinked }}
              </p>
              <UButton
                v-if="!invitePreview"
                class="mt-2"
                size="sm"
                color="neutral"
                variant="soft"
                :loading="inviteAll.isPending.value"
                @click="previewInvite"
              >
                Найти совпадения
              </UButton>
              <UButton
                v-else
                class="mt-2"
                size="sm"
                :disabled="invitePreview.matched - invitePreview.alreadyLinked === 0"
                :loading="inviteAll.isPending.value"
                @click="sendInvite"
              >
                Предложить привязаться
              </UButton>
            </template>
          </div>
        </li>

        <li v-if="data?.canManage" class="flex gap-3">
          <UIcon
            :name="integration.linkPreviews ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-circle'"
            class="mt-0.5 size-5 shrink-0"
            :class="integration.linkPreviews ? 'text-success' : 'text-muted'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-default">Карточки ссылок (по желанию)</p>
            <p class="text-xs text-muted">
              Ссылка на задачу в чате превратится в карточку со статусом и исполнителем. Работает, только когда Такт доступен из интернета.
            </p>
            <UButton v-if="!integration.linkPreviews" class="mt-2" size="sm" color="neutral" variant="soft" @click="advanced = true">
              Как настроить
            </UButton>
          </div>
        </li>
      </ol>

      <UCollapsible v-if="data?.canManage" v-model:open="advanced" class="mt-5 border-t border-default pt-4">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :trailing-icon="advanced ? 'i-hugeicons-arrow-up-01' : 'i-hugeicons-arrow-down-01'"
        >
          Дополнительно
        </UButton>
        <template #content>
          <div class="mt-3 space-y-4">
            <div class="space-y-2">
              <p class="text-xs font-medium text-muted">Вебхук для карточек ссылок</p>
              <p class="text-xs text-muted">
                В карточке бота в Пачке: «Исходящий вебхук» → «Включить», адрес ниже, группа «Ссылки» → unfurl, домен Такта. Затем вставьте Signing secret.
              </p>
              <div class="flex items-center gap-2">
                <UInput :model-value="integration.webhookUrl" readonly class="flex-1" />
                <UButton icon="i-hugeicons-copy-01" color="neutral" variant="ghost" aria-label="Скопировать адрес" @click="copy(integration.webhookUrl)" />
              </div>
              <div class="flex items-center gap-2">
                <UInput
                  v-model="signingSecret"
                  type="password"
                  :placeholder="integration.linkPreviews ? 'Секрет сохранён – вставьте новый, чтобы заменить' : 'Signing secret'"
                  class="flex-1"
                />
                <UButton v-if="integration.linkPreviews" color="neutral" variant="ghost" @click="removeSecret">Убрать</UButton>
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-xs font-medium text-muted">Заменить токен</p>
              <UInput v-model="token" type="password" placeholder="Новый токен бота" class="w-full" />
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton :loading="connect.isPending.value" :disabled="!token.trim() && !signingSecret.trim()" @click="save">Сохранить</UButton>
              <UButton color="error" variant="ghost" @click="confirmDisconnect = true">Отключить Пачку</UButton>
            </div>
          </div>
        </template>
      </UCollapsible>
    </template>

    <template v-else-if="data?.canManage">
      <ol class="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>В Пачке: «Автоматизации» → «Интеграции» → «Чат-боты» → создать бота «Такт».</li>
        <li>Во вкладке «API» бота включить права: messages:create, users:read, chats:read, link_previews:write.</li>
        <li>Скопировать токен бота и вставить сюда.</li>
      </ol>
      <div class="flex gap-2">
        <UInput v-model="token" type="password" placeholder="Токен бота" class="flex-1" />
        <UButton :loading="connect.isPending.value" :disabled="!token.trim()" @click="save">Подключить</UButton>
      </div>
    </template>

    <p v-else-if="data" class="text-sm text-muted">Пачку подключает администратор пространства.</p>

    <UModal v-model:open="confirmDisconnect" title="Отключить Пачку?">
      <template #body>
        <p class="text-sm text-muted">
          Привязки участников и ленты досок этого пространства удалятся. Бот в Пачке останется, его можно удалить там.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmDisconnect = false">Отмена</UButton>
          <UButton color="error" :loading="disconnect.isPending.value" @click="doDisconnect">Отключить</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
