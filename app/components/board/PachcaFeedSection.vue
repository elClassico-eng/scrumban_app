<script setup lang="ts">
import { DEFAULT_FEED_EVENTS, FEED_EVENTS, type BoardFeedView, type FeedEvent, type PachcaChat } from '#shared/types/integrations'

const props = defineProps<{ workspaceId: string, boardId: string }>()

const FEED_EVENT_LABEL: Record<FeedEvent, string> = {
  task_closed: 'Задача закрыта',
  task_reopened: 'Задача переоткрыта',
  task_blocked: 'Появился блокер',
  task_created: 'Задача создана',
  sprint_started: 'Начало спринта',
  sprint_closed: 'Конец спринта',
}

const wsId = computed(() => props.workspaceId)
const { state, chats } = usePachcaApi(wsId)
const ready = computed(() => !!state.data.value?.canManage && state.data.value?.integration?.status === 'active')
const { list, create, update, remove, test } = useBoardFeedsApi(wsId, computed(() => props.boardId), ready)
const toast = useToast()

const chatList = ref<PachcaChat[]>([])
const chatId = ref<string | undefined>()
const adding = ref(false)

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
}

async function startAdding() {
  adding.value = true
  try {
    chatList.value = (await chats()).chats
  }
  catch (err) {
    fail(err, 'Не удалось получить чаты бота')
  }
}

async function add() {
  if (!chatId.value) return
  try {
    await create.mutateAsync({ chatId: chatId.value, events: DEFAULT_FEED_EVENTS, standupTime: '09:30' })
    adding.value = false
    chatId.value = undefined
  }
  catch (err) {
    fail(err, 'Не удалось создать ленту')
  }
}

function toggleEvent(feed: BoardFeedView, event: FeedEvent, on: boolean) {
  const events = on ? [...new Set([...feed.events, event])] : feed.events.filter(e => e !== event)
  update.mutate({ id: feed.id, events }, { onError: err => fail(err, 'Не удалось сохранить') })
}

function setStandup(feedId: string, value: string) {
  update.mutate({ id: feedId, standupTime: value || null }, { onError: err => fail(err, 'Не удалось сохранить') })
}

async function sendTest(feedId: string) {
  try {
    await test.mutateAsync(feedId)
    toast.add({ title: 'Отправили тестовое сообщение', color: 'success', icon: 'i-hugeicons-checkmark-circle-02' })
  }
  catch (err) {
    fail(err, 'Не удалось отправить')
  }
}
</script>

<template>
  <div v-if="ready" class="border-t border-default pt-4">
    <p class="mb-1 text-xs uppercase tracking-wide text-muted">Лента в Пачку</p>
    <p class="mb-3 text-sm text-muted">События доски в чат команды. Бот видит только чаты, куда его добавили.</p>

    <div v-for="feed in list.data.value ?? []" :key="feed.id" class="mb-3 rounded-xl bg-elevated/50 p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium text-default">{{ feed.chatName }}</span>
        <div class="flex shrink-0 items-center gap-1">
          <UBadge v-if="feed.status === 'error'" color="error" variant="soft" size="sm">Ошибка</UBadge>
          <UButton size="xs" color="neutral" variant="ghost" :loading="test.isPending.value" @click="sendTest(feed.id)">Тест</UButton>
          <UButton size="xs" color="error" variant="ghost" icon="i-hugeicons-delete-02" aria-label="Удалить ленту" @click="remove.mutate(feed.id)" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <UCheckbox
          v-for="e in FEED_EVENTS"
          :key="e"
          :model-value="feed.events.includes(e)"
          :label="FEED_EVENT_LABEL[e]"
          @update:model-value="toggleEvent(feed, e, $event === true)"
        />
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        Сводка к стендапу в
        <UInput
          type="time"
          size="sm"
          :model-value="feed.standupTime ?? ''"
          @change="setStandup(feed.id, ($event.target as HTMLInputElement).value)"
        />
        по Москве, по будням
      </div>
    </div>

    <div v-if="adding" class="flex gap-2">
      <USelect v-model="chatId" :items="chatList.map(c => ({ label: c.name, value: c.id }))" placeholder="Чат" class="flex-1" />
      <UButton :disabled="!chatId" :loading="create.isPending.value" @click="add">Добавить</UButton>
    </div>
    <UButton v-else size="sm" color="neutral" variant="soft" icon="i-hugeicons-add-01" @click="startAdding">Добавить ленту</UButton>
  </div>
</template>
