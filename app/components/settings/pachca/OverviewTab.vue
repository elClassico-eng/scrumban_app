<script setup lang="ts">
import type { PachcaStateResponse, WorkspaceFeedView } from '#shared/types/integrations'
import { pachcaSetupSteps, type PachcaSetupStep } from '#shared/utils/pachca-setup'

const props = defineProps<{ state: PachcaStateResponse, feeds: WorkspaceFeedView[] }>()
const emit = defineEmits<{ go: [tab: 'feeds' | 'people' | 'advanced'] }>()

const STEP_INFO: Record<PachcaSetupStep, { title: string, hint: string, tab?: 'feeds' | 'people' | 'advanced', action?: string }> = {
  connect: { title: 'Бот подключён', hint: 'Такт пишет в Пачку от имени бота' },
  link: { title: 'Ты привязан', hint: 'Упоминания и назначения приходят тебе в личку', tab: 'people', action: 'Привязать себя' },
  feed: { title: 'Лента доски в чат', hint: 'Закрытые задачи и блокеры прилетают в чат команды', tab: 'feeds', action: 'Добавить ленту' },
  invite: { title: 'Команда позвана', hint: 'Бот предложит привязаться тем, чья почта совпала', tab: 'people', action: 'Позвать команду' },
  previews: { title: 'Карточки ссылок', hint: 'Ссылка на задачу разворачивается в карточку. По желанию', tab: 'advanced', action: 'Настроить' },
}

const progress = computed(() => pachcaSetupSteps({
  connected: !!props.state.integration,
  linked: !!props.state.me,
  feeds: props.feeds.length,
  linkedMembers: props.state.linkedMembers,
  members: props.state.members,
  linkPreviews: !!props.state.integration?.linkPreviews,
}))

const doneSet = computed(() => progress.value.status)
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
    <SettingsTile>
      <div class="flex flex-col items-center gap-3 py-2 text-center">
        <div
          class="grid size-28 place-items-center rounded-full"
          :style="{ background: `conic-gradient(var(--color-accent-500) ${progress.done / progress.total * 360}deg, var(--ui-bg-accented) 0)` }"
        >
          <span class="grid size-22 place-items-center rounded-full bg-default text-2xl font-semibold text-default">
            {{ progress.done }}/{{ progress.total }}
          </span>
        </div>
        <p class="text-sm text-muted">{{ progress.next ? 'Настройка в процессе' : 'Всё настроено' }}</p>
      </div>
    </SettingsTile>

    <SettingsTile title="Что настроено">
      <ul class="space-y-2">
        <li
          v-for="(info, key) in STEP_INFO"
          :key="key"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5"
          :class="progress.next === key ? 'bg-accent-500/10 ring-1 ring-accent-500/40' : ''"
        >
          <UIcon
            :name="doneSet[key] ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-circle'"
            class="size-5 shrink-0"
            :class="doneSet[key] ? 'text-success' : 'text-muted'"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium" :class="doneSet[key] ? 'text-muted' : 'text-default'">{{ info.title }}</p>
            <p class="text-xs text-muted">{{ info.hint }}</p>
          </div>
          <UButton
            v-if="!doneSet[key] && info.tab && info.action"
            size="xs"
            :variant="progress.next === key ? 'solid' : 'soft'"
            :color="progress.next === key ? 'primary' : 'neutral'"
            @click="emit('go', info.tab)"
          >
            {{ info.action }}
          </UButton>
        </li>
      </ul>
    </SettingsTile>
  </div>
</template>
