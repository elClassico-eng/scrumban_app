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
const { update } = useBoardsApi(wsId)
const toast = useToast()

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
const isViewActive = computed(() => displayViews.value.some(v => v.isActive))
</script>

<template>
  <div
    class="bg-default border-b border-default relative lg:sticky lg:top-0 z-20 -mx-4 sm:-mx-6 transition-all duration-200"
    :class="compact ? 'py-2' : 'py-3'"
  >
    <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4 px-4 sm:px-6 min-h-[44px]">
      <div class="flex flex-col min-w-0 gap-1">
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

      <div class="flex items-center gap-1.5 overflow-x-auto [&>*]:shrink-0 sm:ml-auto sm:overflow-visible">
        <UDropdownMenu :items="dropdownItems">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="isViewActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted hover:bg-elevated hover:text-default'"
          >
            <UIcon :name="currentView.icon" class="size-4 shrink-0" />
            {{ currentView.label }}
            <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 opacity-60" />
          </button>
        </UDropdownMenu>
        <NuxtLink
          :to="sprintsPath"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="isSprintsActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted hover:bg-elevated hover:text-default'"
        >
          Спринты
        </NuxtLink>
        <NuxtLink
          :to="analyticsPath"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="isAnalyticsActive ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted hover:bg-elevated hover:text-default'"
        >
          Аналитика
        </NuxtLink>

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
