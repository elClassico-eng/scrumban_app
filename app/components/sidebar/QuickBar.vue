<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { pageRoutes } from '~/routing'
import { describeCombo } from '~/utils/shortcuts'
import { SIDEBAR_ROW, sidebarFade } from '~/utils/sidebar-items'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boards: Board[]
  canManage: boolean
  collapsed: boolean
}>()
const emit = defineEmits<{ createBoard: [], invite: [] }>()

const route = useRoute()
const router = useRouter()
const ccActions = useControlCenterActions()
const { combos } = useShortcutPrefs()

const isMac = computed(() => import.meta.client && /Mac|iPhone|iPad/i.test(navigator.userAgent))

function createTaskOn(boardId: string) {
  const boardPath = pageRoutes.board(props.workspaceId, boardId)
  if (route.path === boardPath) ccActions.requestCreateTask()
  else router.push({ path: boardPath, query: { create: '1' } })
}

const items = computed<DropdownMenuItem[][]>(() => {
  const routeBoardId = typeof route.params.boardId === 'string' ? route.params.boardId : null
  const task: DropdownMenuItem = routeBoardId
    ? { label: 'Задача', icon: 'i-hugeicons-task-add-01', kbds: describeCombo(combos.value.new_task).keys, onSelect: () => createTaskOn(routeBoardId) }
    : {
        label: 'Задача',
        icon: 'i-hugeicons-task-add-01',
        disabled: !props.boards.length,
        children: props.boards.map(b => ({ label: b.name, onSelect: () => createTaskOn(b.id) })),
      }
  const admin: DropdownMenuItem[] = props.canManage
    ? [
        { label: 'Доска', icon: 'i-hugeicons-square-kanban', onSelect: () => emit('createBoard') },
        { label: 'Пригласить участника', icon: 'i-hugeicons-user-add-01', onSelect: () => emit('invite') },
      ]
    : []
  return [[{ type: 'label', label: 'Создать' }, task, ...admin]]
})
</script>

<template>
  <div class="flex flex-col gap-0.5 px-2 pb-1">
    <UTooltip text="Поиск" :disabled="!collapsed" :content="{ side: 'right' }">
      <button
        type="button"
        :class="[SIDEBAR_ROW, 'cursor-pointer pl-3 pr-2 text-muted hover:bg-elevated hover:text-default']"
        aria-label="Поиск"
        @click="ccActions.requestSearch"
      >
        <UIcon name="i-hugeicons-search-01" class="size-4 shrink-0" />
        <span :class="['flex-1 text-left', sidebarFade(collapsed)]">Поиск</span>
        <span :class="['flex gap-0.5', sidebarFade(collapsed)]">
          <UKbd :value="isMac ? 'meta' : 'ctrl'" />
          <UKbd value="K" />
        </span>
      </button>
    </UTooltip>
    <UDropdownMenu :items="items" :content="{ side: collapsed ? 'right' : 'bottom', align: 'start' }" :ui="{ content: 'w-56' }">
      <button
        type="button"
        :class="[SIDEBAR_ROW, 'group cursor-pointer pl-2.5 pr-2 text-default hover:bg-elevated data-[state=open]:bg-elevated']"
        title="Создать"
        aria-label="Создать"
      >
        <span class="grid size-5 shrink-0 place-items-center rounded-md bg-inverted text-inverted transition-colors group-hover:bg-accent-500 group-hover:text-white group-data-[state=open]:bg-accent-500 group-data-[state=open]:text-white">
          <UIcon name="i-hugeicons-plus" class="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[state=open]:rotate-45 motion-reduce:transition-none" />
        </span>
        <span :class="['flex-1 text-left', sidebarFade(collapsed)]">Создать</span>
        <UIcon name="i-hugeicons-arrow-down-01" :class="['size-3.5 text-dimmed', sidebarFade(collapsed)]" />
      </button>
    </UDropdownMenu>
  </div>
</template>
