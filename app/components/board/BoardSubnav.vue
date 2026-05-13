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
  <div class="flex items-center justify-between gap-4 pb-3 border-b border-default">
    <div class="flex items-center gap-3 min-w-0">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        class="text-sm text-muted hover:text-default flex items-center gap-1 shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        К доскам
      </NuxtLink>
      <input
        v-if="isEditing"
        ref="inputRef"
        v-model="draftName"
        class="text-xl font-bold tracking-tight bg-transparent border-b border-primary outline-none min-w-0 flex-1"
        :disabled="update.isPending.value"
        @keyup.enter="commitEdit"
        @keyup.esc="cancelEdit"
        @blur="commitEdit"
      >
      <h1
        v-else
        class="text-xl font-bold tracking-tight truncate"
        :class="canRename ? 'cursor-text hover:text-primary transition-colors' : ''"
        :title="canRename ? 'Двойной клик — переименовать' : ''"
        @dblclick="startEdit"
      >
        {{ boardName ?? 'Доска' }}
      </h1>
      <UTooltip v-if="sleLabel" :text="sleTooltip">
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          :class="canRename ? 'cursor-pointer hover:bg-accented' : ''"
          @click="canRename && (settingsOpen = true)"
        >
          {{ sleLabel }}
        </UBadge>
      </UTooltip>
      <UTooltip v-if="replenishmentState" :text="replenishmentTooltip">
        <UBadge
          :color="replenishmentState.overdue ? 'error' : 'success'"
          variant="subtle"
          size="sm"
          icon="i-lucide-calendar-clock"
          :class="canRename ? 'cursor-pointer hover:opacity-80' : ''"
          @click="canRename && onMarkReplenishment()"
        >
          {{ replenishmentState.label }}
        </UBadge>
      </UTooltip>
      <UTooltip v-else-if="canRename && board" :text="replenishmentTooltip">
        <UButton
          icon="i-lucide-calendar-plus"
          color="neutral"
          variant="soft"
          size="xs"
          :loading="recordReplenishment.isPending.value"
          @click="onMarkReplenishment"
        >
          Запустить пополнение
        </UButton>
      </UTooltip>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <nav class="flex gap-1">
        <NuxtLink
          :to="pageRoutes.board(workspaceId, boardId)"
          class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
          active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          Доска
        </NuxtLink>
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