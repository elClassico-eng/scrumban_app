<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { pageRoutes } from '~/routing'
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

const isMac = computed(() => import.meta.client && /Mac|iPhone|iPad/i.test(navigator.userAgent))

function createTaskOn(boardId: string) {
  const boardPath = pageRoutes.board(props.workspaceId, boardId)
  if (route.path === boardPath) ccActions.requestCreateTask()
  else router.push({ path: boardPath, query: { create: '1' } })
}

const items = computed<DropdownMenuItem[][]>(() => {
  const routeBoardId = typeof route.params.boardId === 'string' ? route.params.boardId : null
  const task: DropdownMenuItem = routeBoardId
    ? { label: 'Задача', icon: 'i-hugeicons-task-add-01', onSelect: () => createTaskOn(routeBoardId) }
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
  <div :class="['flex gap-1.5 px-3 pb-1', collapsed ? 'flex-col items-center' : 'items-center']">
    <UTooltip text="Поиск" :disabled="!collapsed" :content="{ side: 'right' }">
      <button
        type="button"
        :class="[
          'flex cursor-pointer items-center rounded-xl border border-default bg-default text-sm text-muted shadow-xs transition-colors hover:border-[var(--ui-border-accented)] hover:text-default',
          collapsed ? 'size-9 justify-center' : 'h-9 min-w-0 flex-1 gap-2 px-2.5',
        ]"
        aria-label="Поиск"
        @click="ccActions.requestSearch"
      >
        <UIcon name="i-hugeicons-search-01" class="size-4 shrink-0" />
        <template v-if="!collapsed">
          <span class="truncate">Поиск</span>
          <UKbd class="ml-auto" :value="isMac ? 'meta' : 'ctrl'" />
          <UKbd value="K" />
        </template>
      </button>
    </UTooltip>
    <UDropdownMenu :items="items" :content="{ side: collapsed ? 'right' : 'bottom', align: 'start' }" :ui="{ content: 'w-56' }">
      <button
        type="button"
        :class="[
          'group flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-inverted text-inverted shadow-xs transition-colors hover:bg-accent-500 hover:text-white data-[state=open]:bg-accent-500 data-[state=open]:text-white',
          collapsed ? 'w-9' : 'gap-0.5 px-2',
        ]"
        title="Создать"
        aria-label="Создать"
      >
        <UIcon name="i-hugeicons-plus" class="size-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[state=open]:rotate-45 motion-reduce:transition-none" />
        <UIcon v-if="!collapsed" name="i-hugeicons-arrow-down-01" class="size-3 opacity-70" />
      </button>
    </UDropdownMenu>
  </div>
</template>
