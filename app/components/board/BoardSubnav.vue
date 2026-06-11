<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  workspaceId: string
  boardId: string
  boardName: string | undefined
  canRename: boolean
  board?: Board
  compact?: boolean
}>()

const wsId = computed(() => props.workspaceId)
const route = useRoute()
const isListView = computed(() => route.query.view === 'list')
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

type ReplenishmentState = {
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

type ViewEntry = {
  key: string
  label: string
  icon: string
  to: string | { path: string; query: Record<string, string> }
  isActive: boolean
}

const displayViews = computed<ViewEntry[]>(() => {
  const boardPath = pageRoutes.board(props.workspaceId, props.boardId)
  return [
    {
      key: 'board',
      label: 'Доска',
      icon: 'i-lucide-kanban-square',
      to: boardPath,
      isActive: route.path === boardPath && !isListView.value,
    },
    {
      key: 'list',
      label: 'Список',
      icon: 'i-lucide-list',
      to: { path: boardPath, query: { view: 'list' } },
      isActive: route.path === boardPath && isListView.value,
    },
    {
      key: 'calendar',
      label: 'Календарь',
      icon: 'i-lucide-calendar-days',
      to: pageRoutes.boardCalendar(props.workspaceId, props.boardId),
      isActive: route.path === pageRoutes.boardCalendar(props.workspaceId, props.boardId),
    },
    {
      key: 'timeline',
      label: 'Timeline',
      icon: 'i-lucide-bar-chart-horizontal',
      to: pageRoutes.boardTimeline(props.workspaceId, props.boardId),
      isActive: route.path === pageRoutes.boardTimeline(props.workspaceId, props.boardId),
    },
  ]
})

const currentView = computed<ViewEntry>(
  () => displayViews.value.find(v => v.isActive) ?? displayViews.value[0]!,
)

const dropdownItems = computed<DropdownMenuItem[]>(() =>
  displayViews.value.map(v => ({
    label: v.label,
    icon: v.icon,
    to: v.to,
    ...(v.isActive ? { color: 'primary' as const } : {}),
  })),
)

const sprintsPath = computed(() => pageRoutes.boardSprints(props.workspaceId, props.boardId))
const analyticsPath = computed(() => pageRoutes.boardAnalytics(props.workspaceId, props.boardId))
const isSprintsActive = computed(() => route.path === sprintsPath.value)
const isAnalyticsActive = computed(() => route.path === analyticsPath.value)
</script>

<template>
  <div
    class="bg-default border-b border-default sticky top-0 z-20 -mx-4 sm:-mx-6 transition-all duration-200"
    :class="compact ? 'py-2' : 'py-3'"
  >
    <div class="relative flex items-center px-4 sm:px-6 min-h-[44px]">
      <div class="flex flex-col min-w-0 gap-1 z-10">
        <NuxtLink
          v-show="!compact"
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
            class="font-semibold tracking-tight bg-transparent border-b border-accent-500 outline-none min-w-0 transition-all"
            :class="compact ? 'text-[16px]' : 'text-[22px]'"
            :disabled="update.isPending.value"
            @keyup.enter="commitEdit"
            @keyup.esc="cancelEdit"
            @blur="commitEdit"
          >
          <h1
            v-else
            class="font-semibold tracking-tight truncate transition-all"
            :class="[compact ? 'text-[16px]' : 'text-[22px]', canRename ? 'cursor-text hover:text-accent-600' : '']"
            :title="canRename ? 'Двойной клик — переименовать' : ''"
            @dblclick="startEdit"
          >
            {{ boardName ?? 'Доска' }}
          </h1>
        </div>
      </div>

      <div
        v-if="!compact"
        class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0 rounded-full border px-1 py-1"
        style="background: #16161a; border-color: rgba(255,255,255,0.10);"
      >
        <UDropdownMenu :items="dropdownItems">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium transition-colors text-white/80 hover:text-white hover:bg-white/10"
          >
            <UIcon :name="currentView.icon" class="size-3.5 shrink-0" />
            {{ currentView.label }}
            <UIcon name="i-lucide-chevron-down" class="size-3 shrink-0 opacity-60" />
          </button>
        </UDropdownMenu>

        <div class="w-px h-5 mx-1" style="background: rgba(255,255,255,0.15);" />

        <NuxtLink
          :to="sprintsPath"
          class="px-3 py-1 rounded-full text-[13px] font-medium transition-colors"
          :class="isSprintsActive ? 'text-white bg-white/15' : 'text-white/60 hover:text-white hover:bg-white/10'"
        >
          Спринты
        </NuxtLink>
        <NuxtLink
          :to="analyticsPath"
          class="px-3 py-1 rounded-full text-[13px] font-medium transition-colors"
          :class="isAnalyticsActive ? 'text-white bg-white/15' : 'text-white/60 hover:text-white hover:bg-white/10'"
        >
          Аналитика
        </NuxtLink>
      </div>

      <div class="ml-auto flex items-center gap-1.5 shrink-0 z-10">
        <template v-if="!compact && (sleLabel || replenishmentState || (canRename && board))">
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
        </template>
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
