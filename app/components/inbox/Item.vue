<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Board } from '#shared/types/board'
import type { NotificationActor } from '#shared/types/notification'
import type { InboxView } from '#shared/utils/notification-category'

const props = defineProps<{
  subject: string
  label: string
  detail: string
  actor: NotificationActor | null
  icon: string
  color: string
  board: Board | null
  count: number
  unread: boolean
  time: string
  view: InboxView | 'assigned'
  snoozedUntil?: string | null
}>()

const emit = defineEmits<{
  open: []
  toggleRead: []
  snooze: [until: string]
  clear: []
  restore: []
  resolve: []
}>()

function at(dayOffset: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function nextMonday(): string {
  const d = new Date()
  const add = ((8 - d.getDay()) % 7) || 7
  d.setDate(d.getDate() + add)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

const snoozeItems = computed<DropdownMenuItem[][]>(() => [[
  { type: 'label', label: 'Напомнить' },
  { label: 'Через 3 часа', icon: 'i-hugeicons-clock-01', onSelect: () => emit('snooze', new Date(Date.now() + 3 * 3_600_000).toISOString()) },
  { label: 'Завтра в 9:00', icon: 'i-hugeicons-sunrise', onSelect: () => emit('snooze', at(1, 9)) },
  { label: 'В понедельник в 9:00', icon: 'i-hugeicons-calendar-03', onSelect: () => emit('snooze', nextMonday()) },
]])

const snoozeOpen = ref(false)
const snoozeLabel = computed(() => props.snoozedUntil
  ? new Date(props.snoozedUntil).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '')
</script>

<template>
  <div
    class="group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-elevated focus-visible:bg-elevated md:grid-cols-[minmax(0,3fr)_24px_minmax(0,5fr)_12.5rem]"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <BoardAvatar :board="board" />
      <span :class="['truncate text-sm', unread ? 'font-semibold text-highlighted' : 'text-default']">{{ subject }}</span>
    </div>

    <span class="hidden md:block">
      <UserAvatar v-if="actor" :user="actor" size="sm" />
      <span v-else class="grid size-6 place-items-center rounded-full" :style="{ background: `${color}1a`, color }">
        <UIcon :name="icon" class="size-3.5" />
      </span>
    </span>

    <p :class="['col-span-2 row-start-2 min-w-0 truncate text-sm md:col-span-1 md:row-start-auto', unread ? 'text-default' : 'text-muted']">
      <span v-if="actor" class="font-medium text-highlighted">{{ displayName(actor) }}</span>
      <span :class="['text-accent-600 dark:text-accent-400', actor ? 'ml-1' : '']">{{ label }}</span>
      <template v-if="detail">
        <span class="mx-1 text-dimmed">·</span>{{ deserializeMentions(detail).text }}
      </template>
    </p>

    <div class="relative col-start-2 row-start-1 flex h-7 items-center justify-end gap-2 md:col-start-auto md:row-start-auto" @click.stop>
      <span
        v-if="count > 1"
        class="grid h-5 min-w-5 place-items-center rounded-full border border-default px-1 text-[11px] tabular-nums text-muted"
      >{{ count }}</span>
      <span class="w-24 whitespace-nowrap text-right text-xs text-dimmed tabular-nums">{{ view === 'later' ? snoozeLabel : time }}</span>

      <div
        :class="[
          'absolute inset-y-0 right-0 flex items-center gap-1 bg-gradient-to-l from-[var(--ui-bg-elevated)] from-80% to-transparent pl-8 transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none',
          snoozeOpen
            ? 'translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-1 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-x-0 group-focus-visible:opacity-100',
        ]"
      >
        <template v-if="view === 'assigned'">
          <UButton size="xs" icon="i-hugeicons-checkmark-circle-02" @click="emit('resolve')">Выполнено</UButton>
        </template>
        <template v-else-if="view === 'cleared'">
          <UButton size="xs" color="neutral" variant="outline" icon="i-hugeicons-undo-02" @click="emit('restore')">Вернуть</UButton>
        </template>
        <template v-else>
          <UTooltip :text="unread ? 'Прочитано' : 'Непрочитано'">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="unread ? 'i-hugeicons-mail-open-01' : 'i-hugeicons-mail-01'"
              :aria-label="unread ? 'Отметить прочитанным' : 'Отметить непрочитанным'"
              @click="emit('toggleRead')"
            />
          </UTooltip>
          <UButton v-if="view === 'later'" size="xs" color="neutral" variant="ghost" icon="i-hugeicons-inbox" aria-label="Вернуть сейчас" @click="emit('restore')" />
          <UDropdownMenu v-else v-model:open="snoozeOpen" :items="snoozeItems" :content="{ align: 'end' }">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-hugeicons-clock-01" aria-label="Отложить" />
          </UDropdownMenu>
          <UButton size="xs" icon="i-hugeicons-tick-02" @click="emit('clear')">Разобрать</UButton>
        </template>
      </div>
    </div>
  </div>
</template>
