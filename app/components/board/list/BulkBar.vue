<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  selected: Set<string>
  columns: Column[]
  members: MemberView[]
  workspaceId: string
  boardId: string
}>()

const emit = defineEmits<{ clear: [] }>()

const { update, move } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))
const qc = useQueryClient()
const toast = useToast()
const ids = computed(() => [...props.selected])
const pending = ref(false)

function invalidateTasks() {
  qc.invalidateQueries({ queryKey: ['tasks', props.workspaceId, props.boardId] })
  qc.invalidateQueries({ queryKey: ['task-subtasks'] })
}

const doneColumn = computed(() => props.columns.find(c => c.columnRole === 'done') ?? null)

async function runBulk(work: () => Promise<void>, title: string) {
  if (pending.value) return
  pending.value = true
  try {
    await work()
    invalidateTasks()
    toast.add({ title, icon: 'i-lucide-check-circle' })
    emit('clear')
  }
  finally {
    pending.value = false
  }
}

const assignItems = computed(() =>
  props.members.map(m => ({
    label: displayName(m),
    member: m,
    onSelect: () => runBulk(async () => {
      await Promise.allSettled(ids.value.map(id =>
        $fetch(apiRoutes.taskAssignees(props.workspaceId, props.boardId, id), { method: 'POST', body: { userId: m.userId } }),
      ))
    }, `Назначено: ${displayName(m)}`),
  })),
)

const dueOpen = ref(false)
function applyDue(e: Event) {
  const v = (e.target as HTMLInputElement).value
  const iso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  dueOpen.value = false
  runBulk(async () => {
    await Promise.allSettled(ids.value.map(id => update.mutateAsync({ taskId: id, dueDate: iso })))
  }, 'Срок обновлён')
}

function closeSelected() {
  const col = doneColumn.value
  if (!col) return
  runBulk(async () => {
    await Promise.allSettled(ids.value.map((id, i) =>
      move.mutateAsync({ taskId: id, toColumnId: col.id, toPosition: i }),
    ))
  }, 'Задачи закрыты')
}
</script>

<template>
  <div class="sticky bottom-4 mx-auto w-max max-w-[calc(100vw-1.5rem)] flex items-center gap-2.5 sm:gap-3.5 bg-zinc-900 text-white rounded-full py-2 pr-2.5 pl-4 sm:pl-[18px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] z-50">
    <span class="text-[13px] font-semibold"><b class="text-accent-500">{{ selected.size }}</b> выбрано</span>
    <div class="flex items-center gap-1">
      <UDropdownMenu :items="assignItems" :ui="{ content: 'w-60 max-h-72 overflow-auto' }">
        <button class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-user" class="size-3.5" /> <span class="hidden sm:inline">Назначить</span>
        </button>
        <template #item-leading="{ item }">
          <UserAvatar :user="(item as any).member" size="xs" />
        </template>
      </UDropdownMenu>

      <UPopover v-model:open="dueOpen">
        <button class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-calendar" class="size-3.5" /> <span class="hidden sm:inline">Срок</span>
        </button>
        <template #content>
          <div class="p-2"><input type="date" class="h-8 px-2 rounded-md bg-default border border-default text-sm text-default" @change="applyDue"></div>
        </template>
      </UPopover>

      <button
        v-if="doneColumn"
        class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5"
        @click="closeSelected"
      >
        <UIcon name="i-lucide-check" class="size-3.5" /> <span class="hidden sm:inline">Закрыть</span>
      </button>

      <button class="size-[30px] grid place-items-center rounded-full text-white/70 hover:bg-white/10" @click="emit('clear')">
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
  </div>
</template>
