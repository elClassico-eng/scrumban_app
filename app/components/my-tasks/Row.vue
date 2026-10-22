<script setup lang="ts">
import type { Board } from '#shared/types/board'
import type { BoardColumn } from '#shared/types/column'
import type { Task } from '#shared/types/task'
import { COLUMN_ROLE_INFO } from '~/utils/column-role'
import { dueInfo } from '~/utils/due'

const props = defineProps<{
  task: Task
  board: Board | null
  column: BoardColumn | null
}>()

const emit = defineEmits<{ open: [] }>()

const due = computed(() => (props.task.closedAt ? null : dueInfo(props.task.dueDate)))

const dueText = computed(() => {
  const d = due.value
  if (!d) return ''
  if (d.tone === 'overdue') return `просрочено ${-d.diff} дн`
  if (d.tone === 'today') return 'сегодня'
  if (d.diff === 1) return 'завтра'
  return d.dateLabel
})

const DUE_TONE = {
  overdue: 'font-semibold text-error',
  today: 'font-semibold text-accent-600 dark:text-accent-400',
  soon: 'text-warning',
  normal: 'text-muted',
} as const

const closedText = computed(() => props.task.closedAt
  ? new Date(props.task.closedAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  : '')
</script>

<template>
  <div
    class="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-elevated focus-visible:bg-elevated md:grid-cols-[minmax(0,4fr)_minmax(0,1.6fr)_3.5rem_8rem]"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <BoardAvatar :board="board" />
      <span :class="['truncate text-sm', task.closedAt ? 'text-muted line-through' : 'font-medium text-highlighted']">{{ task.title }}</span>
    </div>

    <span class="hidden min-w-0 items-center gap-2 text-sm text-muted md:flex">
      <span
        v-if="column"
        :class="['size-2 shrink-0 rounded-full', column.color ? '' : COLUMN_ROLE_INFO[column.columnRole].dotClass]"
        :style="column.color ? { background: column.color } : undefined"
      />
      <span class="truncate">{{ column?.name ?? '—' }}</span>
    </span>

    <span class="hidden items-center gap-1.5 md:flex">
      <UTooltip v-if="task.serviceClass === 'expedite'" text="Срочная">
        <UIcon name="i-hugeicons-zap" class="size-4 text-error" />
      </UTooltip>
      <UTooltip v-if="task.blockedSince" text="Есть блокер">
        <UIcon name="i-hugeicons-octagon-x" class="size-4 text-warning" />
      </UTooltip>
    </span>

    <span class="whitespace-nowrap text-right text-xs tabular-nums">
      <span v-if="task.closedAt" class="text-dimmed">закрыта {{ closedText }}</span>
      <span v-else-if="due" :class="DUE_TONE[due.tone]">{{ dueText }}</span>
      <span v-else class="text-dimmed">без срока</span>
    </span>
  </div>
</template>
