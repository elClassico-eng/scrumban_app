<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { DueInfo } from '~/utils/due'

const props = defineProps<{
  task: Task
  due: DueInfo | null
  isDone: boolean
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()

const { update } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))
const open = ref(false)
const localDate = computed(() => props.task.dueDate ? props.task.dueDate.slice(0, 10) : '')

const pill = computed(() => {
  const d = props.due
  if (!d) return { cls: 'bg-transparent text-dimmed pl-0', text: '—', noIcon: true }
  if (props.isDone) return { cls: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400', text: d.dateLabel }
  if (d.tone === 'overdue') return { cls: 'bg-red-500 text-white', text: d.dateLabel }
  if (d.tone === 'today') return { cls: 'bg-accent-500 text-white', text: 'сегодня' }
  if (d.tone === 'soon') return { cls: 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-400', text: d.diff === 1 ? 'завтра' : d.dateLabel }
  return { cls: 'bg-elevated text-toned', text: d.dateLabel }
})

function onPick(v: string) {
  const iso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  update.mutate({ taskId: props.task.id, dueDate: iso })
  open.value = false
}
function clearDue() {
  update.mutate({ taskId: props.task.id, dueDate: null })
  open.value = false
}
</script>

<template>
  <UPopover v-if="canEdit" v-model:open="open">
    <button
      class="inline-flex items-center gap-[6px] h-[24px] px-[9px] rounded-[7px] text-[12px] font-medium tabular-nums transition-opacity hover:opacity-80"
      :class="pill.cls"
    >
      <UIcon v-if="!pill.noIcon" name="i-lucide-calendar" class="size-[13px] shrink-0" />
      {{ pill.text }}
    </button>
    <template #content>
      <div class="p-2 flex flex-col gap-2">
        <CommonDateCalendar :model-value="localDate" @update:model-value="onPick" />
        <button class="text-xs text-muted hover:text-red-500 text-left" @click="clearDue">Очистить срок</button>
      </div>
    </template>
  </UPopover>
  <span
    v-else
    class="inline-flex items-center gap-[6px] h-[24px] px-[9px] rounded-[7px] text-[12px] font-medium tabular-nums"
    :class="pill.cls"
  >
    <UIcon v-if="!pill.noIcon" name="i-lucide-calendar" class="size-[13px] shrink-0" />
    {{ pill.text }}
  </span>
</template>
