<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { Motion } from 'motion-v'
import { BOARD_COLOR_LABELS, BOARD_COLORS } from '#shared/constants/board-colors'
import type { Board } from '#shared/types/board'
import { pageRoutes } from '~/routing'
import { SIDEBAR_SPRING } from '~/utils/sidebar-items'

const props = defineProps<{
  workspaceId: string
  board: Board
  active: boolean
  favorite: boolean
  collapsed: boolean
  indicator?: string
}>()
const emit = defineEmits<{ toggleFavorite: [] }>()

const { current } = useCurrentWorkspace()
const actions = useBoardActions(() => props.workspaceId)
const canManage = computed(() => hasRole(current.value?.role, 'admin'))
const canDelete = computed(() => hasRole(current.value?.role, 'owner'))

const letter = computed(() => props.board.name.trim().charAt(0).toUpperCase() || '·')

const menuOpen = ref(false)
const editing = ref(false)
const draft = ref('')
const input = ref<{ inputRef?: HTMLInputElement } | null>(null)

function startRename() {
  if (!canManage.value) return
  draft.value = props.board.name
  editing.value = true
  nextTick(() => input.value?.inputRef?.select())
}

function commitRename() {
  if (!editing.value) return
  editing.value = false
  actions.rename(props.board, draft.value)
}

function swatchOf(item: unknown): string | undefined {
  return (item as { swatch?: string }).swatch
}

const items = computed<DropdownMenuItem[][]>(() => {
  const b = props.board
  const edit: DropdownMenuItem[] = canManage.value
    ? [
        { label: 'Переименовать', icon: 'i-hugeicons-pencil-edit-02', onSelect: startRename },
        {
          label: 'Цвет',
          icon: 'i-hugeicons-paint-board',
          children: BOARD_COLORS.map(c => ({
            label: BOARD_COLOR_LABELS[c],
            slot: 'swatch' as const,
            swatch: c,
            onSelect: () => actions.recolor(b, c),
          })),
        },
      ]
    : []
  const everyone: DropdownMenuItem[] = [
    { label: props.favorite ? 'Убрать из избранного' : 'В избранное', icon: 'i-hugeicons-star', onSelect: () => emit('toggleFavorite') },
    { label: 'Скопировать ссылку', icon: 'i-hugeicons-link-01', onSelect: () => actions.copyLink(b) },
  ]
  const danger: DropdownMenuItem[] = [
    ...(canManage.value ? [{ label: 'В архив', icon: 'i-hugeicons-archive', onSelect: () => actions.archive(b) }] : []),
    ...(canDelete.value ? [{ label: 'Удалить навсегда', icon: 'i-hugeicons-delete-02', color: 'error' as const, onSelect: () => actions.askDelete(b) }] : []),
  ]
  return [edit, everyone, danger].filter(g => g.length)
})
</script>

<template>
  <div
    v-if="editing && !collapsed"
    class="flex items-center gap-3 rounded-xl bg-elevated py-1 pl-3 pr-1.5"
  >
    <span
      class="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
      :style="{ background: board.color }"
    >{{ letter }}</span>
    <UInput
      ref="input"
      v-model="draft"
      size="sm"
      class="min-w-0 flex-1"
      aria-label="Название доски"
      @keydown.enter.prevent="commitRename"
      @keydown.esc.prevent.stop="editing = false"
      @blur="commitRename"
    />
  </div>
  <UTooltip v-else :text="board.name" :disabled="!collapsed" :content="{ side: 'right' }">
    <NuxtLink
      :to="pageRoutes.board(workspaceId, board.id)"
      :aria-current="active ? 'page' : undefined"
      :class="[
        'group relative flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center p-2' : 'gap-3 py-2 pl-3 pr-1.5',
        active ? 'text-highlighted font-semibold' : 'text-muted hover:bg-elevated hover:text-default',
      ]"
    >
      <Motion
        v-if="active"
        :layout-id="indicator ?? 'sidebar-active'"
        class="absolute inset-0 rounded-xl bg-accented"
        :transition="SIDEBAR_SPRING"
      />
      <span
        class="relative grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
        :style="{ background: board.color }"
      >{{ letter }}</span>
      <template v-if="!collapsed">
        <span class="relative min-w-0 flex-1 truncate" @dblclick.prevent="startRename">{{ board.name }}</span>
        <span class="relative flex items-center" @click.prevent.stop>
          <UDropdownMenu v-model:open="menuOpen" :items="items" :content="{ align: 'start', side: 'right' }" :ui="{ content: 'w-56' }">
            <button
              type="button"
              :class="[
                'grid size-6 shrink-0 place-items-center rounded-md text-dimmed transition-opacity hover:bg-default hover:text-default',
                menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              ]"
              aria-label="Действия с доской"
            >
              <UIcon name="i-hugeicons-more-horizontal" class="size-3.5" />
            </button>
            <template #swatch-leading="{ item }">
              <span class="size-4 shrink-0 rounded-full" :style="{ background: swatchOf(item) }" />
            </template>
            <template #swatch-trailing="{ item }">
              <UIcon v-if="swatchOf(item) === board.color" name="i-hugeicons-check" class="size-4 text-accent-600 dark:text-accent-400" />
            </template>
          </UDropdownMenu>
          <button
            type="button"
            :class="[
              'grid size-6 shrink-0 place-items-center rounded-md transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-default active:scale-75',
              favorite ? 'text-accent-600 dark:text-accent-400 opacity-100' : 'text-dimmed opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            ]"
            :aria-label="favorite ? 'Убрать из избранного' : 'В избранное'"
            :aria-pressed="favorite"
            @click="emit('toggleFavorite')"
          >
            <UIcon name="i-hugeicons-star" class="size-3.5" />
          </button>
        </span>
      </template>
    </NuxtLink>
  </UTooltip>
</template>
