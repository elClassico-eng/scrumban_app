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

function invalidateTasks() {
  qc.invalidateQueries({ queryKey: ['tasks', props.workspaceId, props.boardId] })
}

const doneColumn = computed(() => props.columns.find(c => c.columnRole === 'done') ?? null)

const assignItems = computed(() =>
  props.members.map(m => ({
    label: displayName(m),
    onSelect: async () => {
      await Promise.allSettled(ids.value.map(id =>
        $fetch(apiRoutes.taskAssignees(props.workspaceId, props.boardId, id), { method: 'POST', body: { userId: m.userId } }),
      ))
      invalidateTasks()
      toast.add({ title: `Назначено: ${displayName(m)}`, icon: 'i-lucide-check-circle' })
      emit('clear')
    },
  })),
)

const dueOpen = ref(false)
async function applyDue(e: Event) {
  const v = (e.target as HTMLInputElement).value
  const iso = v ? new Date(`${v}T23:59:59Z`).toISOString() : null
  await Promise.allSettled(ids.value.map(id => update.mutateAsync({ taskId: id, dueDate: iso })))
  invalidateTasks()
  dueOpen.value = false
  toast.add({ title: 'Срок обновлён', icon: 'i-lucide-check-circle' })
  emit('clear')
}

async function closeSelected() {
  if (!doneColumn.value) return
  await Promise.allSettled(ids.value.map((id, i) =>
    move.mutateAsync({ taskId: id, toColumnId: doneColumn.value!.id, toPosition: i }),
  ))
  invalidateTasks()
  toast.add({ title: 'Задачи закрыты', icon: 'i-lucide-check-circle' })
  emit('clear')
}
</script>

<template>
  <div class="sticky bottom-4 mx-auto w-max flex items-center gap-3.5 bg-inverted text-inverted rounded-full py-2 pr-2.5 pl-[18px] shadow-xl z-[5]">
    <span class="text-[13px] font-semibold"><b class="text-accent-500">{{ selected.size }}</b> выбрано</span>
    <div class="flex items-center gap-1">
      <UDropdownMenu :items="assignItems" :ui="{ content: 'w-56 max-h-64 overflow-auto' }">
        <button class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-user" class="size-3.5" /> Назначить
        </button>
      </UDropdownMenu>

      <UPopover v-model:open="dueOpen">
        <button class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-calendar" class="size-3.5" /> Срок
        </button>
        <template #content>
          <div class="p-2"><input type="date" class="h-8 px-2 rounded-md bg-default border border-default text-sm text-default" @input="applyDue"></div>
        </template>
      </UPopover>

      <button
        v-if="doneColumn"
        class="h-[30px] px-3 bg-white/10 hover:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5"
        @click="closeSelected"
      >
        <UIcon name="i-lucide-check" class="size-3.5" /> Закрыть
      </button>

      <button class="size-[30px] grid place-items-center rounded-full text-inverted/70 hover:bg-white/10" @click="emit('clear')">
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
  </div>
</template>
