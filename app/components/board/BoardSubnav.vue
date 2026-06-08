<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boardId: string
  boardName: string | undefined
  canRename: boolean
  board?: Board
}>()

const wsId = computed(() => props.workspaceId)
const { update, recordReplenishment } = useBoardsApi(wsId)
const toast = useToast()
const confirm = useConfirm()

async function onMarkReplenishment() {
  if (!props.canRename) return
  const ok = await confirm({
    title: 'Отметить replenishment сейчас?',
    description: 'Сбросит счётчик периода. Используй после реальной встречи планирования backlog\'а.',
    confirmLabel: 'Отметить',
  })
  if (!ok) return
  try {
    await recordReplenishment.mutateAsync(props.boardId)
    toast.add({
      title: 'Replenishment отмечен',
      icon: 'i-lucide-check-circle',
      color: 'success',
    })
  }
  catch {
    toast.add({
      title: 'Не удалось отметить',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const isEditing = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startEdit() {
  if (!props.canRename) return
  draftName.value = props.boardName ?? ''
  isEditing.value = true
  nextTick(() => inputRef.value?.focus())
}

function cancelEdit() {
  isEditing.value = false
  draftName.value = ''
}

async function commitEdit() {
  const trimmed = draftName.value.trim()
  if (!trimmed || trimmed === props.boardName) {
    cancelEdit()
    return
  }
  try {
    await update.mutateAsync({ boardId: props.boardId, name: trimmed })
    isEditing.value = false
  }
  catch {
    toast.add({
      title: 'Не удалось переименовать доску',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const settingsOpen = ref(false)

const sleLabel = computed(() => {
  if (!props.board) return null
  if (props.board.sleDays == null) return 'Прогноз не задан'
  const pct = Math.round(Number(props.board.sleProbability) * 100)
  return `Прогноз: ${pct}% за ${props.board.sleDays} дн`
})
const sleTooltip = 'Service Level Expectation — вероятностный прогноз сроков. Например, «85% задач закрываются за 10 дней». Используется для индикаторов aging WIP.'

interface ReplenishmentState {
  daysLeft: number
  overdue: boolean
  label: string
}
const replenishmentState = computed<ReplenishmentState | null>(() => {
  if (!props.board?.lastReplenishmentAt) return null
  const last = new Date(props.board.lastReplenishmentAt).getTime()
  const period = props.board.replenishmentPeriodDays * 86_400_000
  const due = last + period
  const daysLeft = Math.round((due - Date.now()) / 86_400_000)
  if (daysLeft < 0) {
    return { daysLeft, overdue: true, label: `Пополнение просрочено на ${-daysLeft} дн` }
  }
  return { daysLeft, overdue: false, label: `Пополнение через ${daysLeft} дн` }
})
const replenishmentTooltip = 'Пополнение бэклога — регулярная встреча планирования (replenishment). Клик отмечает её как проведённую и сбрасывает счётчик периода.'
</script>

<template>
  <div class="flex items-start justify-between gap-4 pb-3 border-b border-default">
    <div class="flex flex-col min-w-0 gap-1">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        class="text-[12px] text-muted hover:text-default transition-colors w-fit"
      >
        Доски
      </NuxtLink>
      <div class="flex items-center gap-2 min-w-0">
        <input
          v-if="isEditing"
          ref="inputRef"
          v-model="draftName"
          class="text-[22px] font-semibold tracking-tight bg-transparent border-b border-accent-500 outline-none min-w-0"
          :disabled="update.isPending.value"
          @keyup.enter="commitEdit"
          @keyup.esc="cancelEdit"
          @blur="commitEdit"
        >
        <h1
          v-else
          class="text-[22px] font-semibold tracking-tight truncate"
          :class="canRename ? 'cursor-text hover:text-accent-600 transition-colors' : ''"
          :title="canRename ? 'Двойной клик — переименовать' : ''"
          @dblclick="startEdit"
        >
          {{ boardName ?? 'Доска' }}
        </h1>
      </div>
      <div
        v-if="sleLabel || replenishmentState || (canRename && board)"
        class="flex items-center gap-1.5 flex-wrap mt-1"
      >
        <UTooltip v-if="sleLabel" :text="sleTooltip">
          <button
            type="button"
            :disabled="!canRename"
            class="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full bg-accent-50 text-accent-600 text-[11.5px] font-medium tabular-nums transition-colors disabled:cursor-default"
            :class="canRename ? 'cursor-pointer hover:bg-accent-100' : ''"
            @click="canRename && (settingsOpen = true)"
          >
            <UIcon name="i-lucide-sparkles" class="size-3" />
            {{ sleLabel }}
          </button>
        </UTooltip>
        <UTooltip v-if="replenishmentState" :text="replenishmentTooltip">
          <button
            type="button"
            :disabled="!canRename"
            :class="[
              'inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full text-[11.5px] font-medium transition-colors disabled:cursor-default',
              replenishmentState.overdue
                ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
                : 'bg-elevated text-muted hover:bg-accented',
              canRename && 'cursor-pointer',
            ]"
            @click="canRename && onMarkReplenishment()"
          >
            <UIcon name="i-lucide-calendar" class="size-3" />
            {{ replenishmentState.label }}
          </button>
        </UTooltip>
        <UTooltip v-else-if="canRename && board" :text="replenishmentTooltip">
          <button
            type="button"
            :disabled="recordReplenishment.isPending.value"
            class="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full bg-elevated text-muted hover:bg-accented text-[11.5px] font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            @click="onMarkReplenishment"
          >
            <UIcon name="i-lucide-calendar" class="size-3" />
            Запустить пополнение
          </button>
        </UTooltip>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <nav class="flex gap-1 items-center">
        <NuxtLink
          :to="pageRoutes.board(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors inline-flex items-center gap-1.5"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          <UIcon name="i-lucide-kanban-square" class="size-4" />
          Доска
        </NuxtLink>
        <NuxtLink
          :to="pageRoutes.boardCalendar(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors inline-flex items-center gap-1.5"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          <UIcon name="i-lucide-calendar-days" class="size-4" />
          Календарь
        </NuxtLink>
        <NuxtLink
          :to="pageRoutes.boardTimeline(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors inline-flex items-center gap-1.5"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          <UIcon name="i-lucide-bar-chart-horizontal" class="size-4" />
          Timeline
        </NuxtLink>
        <span class="w-px h-5 bg-default mx-1" />
        <NuxtLink
          :to="pageRoutes.boardSprints(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          Спринты
        </NuxtLink>
        <NuxtLink
          :to="pageRoutes.boardAnalytics(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          Аналитика
        </NuxtLink>
      </nav>
      <UButton
        v-if="canRename"
        icon="i-lucide-settings"
        color="neutral"
        variant="ghost"
        size="sm"
        title="Настройки доски"
        @click="settingsOpen = true"
      />
    </div>
    <BoardSettingsModal
      v-if="canRename && board"
      v-model:open="settingsOpen"
      :workspace-id="workspaceId"
      :board-id="boardId"
      :board="board"
    />
  </div>
</template>