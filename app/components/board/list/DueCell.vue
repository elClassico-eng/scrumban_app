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

const display = computed(() => {
  const d = props.due
  if (!d) return { cls: 'text-dimmed', icon: undefined, text: '—' }
  if (props.isDone) return { cls: 'text-emerald-600', icon: undefined, text: d.dateLabel }
  if (d.tone === 'overdue') return { cls: 'text-white bg-red-500 px-2.5 py-0.5 rounded-full font-semibold', icon: undefined, text: d.dateLabel }
  if (d.tone === 'today') return { cls: 'text-white bg-accent-500 px-2.5 py-0.5 rounded-full font-semibold', icon: undefined, text: 'сегодня' }
  if (d.tone === 'soon') return { cls: 'text-accent-600 font-semibold', icon: 'text-accent-500', text: d.diff === 1 ? 'завтра' : d.dateLabel }
  return { cls: 'text-toned', icon: 'text-muted', text: d.dateLabel }
})

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
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
    <button class="inline-flex items-center gap-[5px] text-xs tabular-nums rounded hover:opacity-80 transition-opacity" :class="display.cls">
      <UIcon name="i-lucide-calendar" class="size-3" :class="display.icon" />{{ display.text }}
    </button>
    <template #content>
      <div class="p-2 flex flex-col gap-2">
        <input type="date" :value="localDate" class="h-8 px-2 rounded-md bg-default border border-default text-sm text-default" @input="onInput">
        <button class="text-xs text-muted hover:text-red-500 text-left" @click="clearDue">Очистить срок</button>
      </div>
    </template>
  </UPopover>
  <span v-else class="inline-flex items-center gap-[5px] text-xs tabular-nums" :class="display.cls">
    <UIcon name="i-lucide-calendar" class="size-3" :class="display.icon" />{{ display.text }}
  </span>
</template>
