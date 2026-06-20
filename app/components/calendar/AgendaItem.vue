<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  task: Task
  member: MemberView | null
  columnName: string | null
}>()

const emit = defineEmits<{
  open: [taskId: string]
}>()

const dueDate = computed(() => props.task.dueDate ? dueLocalDay(props.task.dueDate) : null)
const due = computed(() => props.task.dueDate ? dueDayInfo(props.task.dueDate) : null)
const isDone = computed(() => !!props.task.closedAt)
const sc = computed(() => SERVICE_CLASS_INFO[props.task.serviceClass])

const dayNum = computed(() => dueDate.value?.getDate() ?? '')
const weekday = computed(() => dueDate.value?.toLocaleDateString('ru', { weekday: 'short' }) ?? '')

const badge = computed(() => {
  const d = due.value
  if (!d) return null
  if (isDone.value) return { cls: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400', text: 'Выполнено' }
  if (d.tone === 'overdue') return { cls: 'bg-red-500 text-white', text: 'Просрочено' }
  if (d.tone === 'today') return { cls: 'bg-accent-500 text-white', text: 'Сегодня' }
  if (d.tone === 'soon') return { cls: 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-400', text: 'Скоро' }
  return { cls: 'bg-elevated text-toned', text: 'Срок' }
})

const relative = computed(() => {
  const d = due.value
  if (!d || isDone.value) return null
  const n = d.diff
  if (n < 0) return `просрочено на ${-n} дн.`
  if (n === 0) return 'сегодня'
  if (n === 1) return 'завтра'
  return `через ${n} дн.`
})

let ghostEl: HTMLElement | null = null

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('text/task-id', props.task.id)
  e.dataTransfer.effectAllowed = 'move'
  const ghost = document.createElement('div')
  ghost.textContent = props.task.title
  ghost.style.cssText = [
    'position:fixed', 'top:-1000px', 'left:-1000px',
    'max-width:240px', 'padding:6px 12px', 'border-radius:8px',
    'background:#18181b', 'color:#fff', 'font-size:12px', 'font-weight:500',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
    'box-shadow:0 8px 20px -8px rgba(0,0,0,.45)',
  ].join(';')
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 14, 16)
  ghostEl = ghost
}

function onDragEnd() {
  ghostEl?.remove()
  ghostEl = null
}
</script>

<template>
  <div
    draggable="true"
    class="flex items-stretch gap-3 p-3 rounded-xl border border-default bg-default hover:border-accent-500/40 transition-colors cursor-grab active:cursor-grabbing"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="emit('open', task.id)"
  >
    <div class="w-10 shrink-0 flex flex-col items-center justify-center text-center">
      <div class="text-lg font-semibold tabular-nums leading-none">{{ dayNum }}</div>
      <div class="text-[11px] uppercase text-muted mt-0.5">{{ weekday }}</div>
    </div>

    <div class="min-w-0 flex-1 flex flex-col justify-center gap-1.5 border-l border-default pl-3">
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm font-medium text-default truncate">{{ task.title }}</p>
        <span
          v-if="badge"
          class="shrink-0 inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-medium"
          :class="badge.cls"
        >
          {{ badge.text }}
        </span>
      </div>

      <div class="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-1.5 rounded-full" :class="sc.dotClass" />
          {{ sc.shortLabel }}
        </span>
        <span v-if="columnName" class="truncate max-w-32">{{ columnName }}</span>
        <span v-if="member" class="inline-flex items-center gap-1.5">
          <UAvatar
            :src="member.avatarUrl ?? undefined"
            :alt="displayName(member)"
            :text="initials(member)"
            size="2xs"
          />
          <span class="truncate max-w-28">{{ displayName(member) }}</span>
        </span>
        <span v-if="relative" class="tabular-nums">{{ relative }}</span>
        <span v-if="task.blockedReason" class="inline-flex items-center gap-1 text-red-500">
          <UIcon name="i-lucide-ban" class="size-3.5" />
          заблок.
        </span>
      </div>
    </div>
  </div>
</template>
