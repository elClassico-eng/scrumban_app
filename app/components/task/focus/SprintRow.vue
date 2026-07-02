<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
  taskTitle: string
  taskStoryPoints?: number | null
  canEdit: boolean
}>()

const { memberships, removeFrom } = useTaskSprintMembership(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
  computed(() => props.taskId),
)

const toast = useToast()
const pickerOpen = ref(false)

const STATE_LABEL: Record<string, string> = {
  active: 'активный',
  planned: 'запланирован',
}

async function onRemove(sprintId: string) {
  try {
    await removeFrom.mutateAsync(sprintId)
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось убрать из спринта'), color: 'error', icon: 'i-lucide-alert-circle' })
  }
}
</script>

<template>
  <TaskFocusPropRow icon="i-lucide-iteration-ccw" label="Спринт" align-start>
    <div class="flex flex-col gap-1.5 w-full">
      <template v-if="memberships.length">
        <span
          v-for="s in memberships"
          :key="s.id"
          class="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md bg-elevated text-[12px] text-default self-start max-w-full"
        >
          <span class="size-1.5 rounded-full shrink-0" :class="s.state === 'active' ? 'bg-emerald-500' : 'bg-accented'" />
          <span class="truncate">{{ s.name }}</span>
          <span class="text-[10.5px] text-muted shrink-0">{{ STATE_LABEL[s.state] }}</span>
          <button
            v-if="canEdit"
            type="button"
            class="size-4 rounded grid place-items-center text-dimmed hover:bg-accented hover:text-default cursor-pointer transition-colors shrink-0"
            title="Убрать из спринта"
            @click="onRemove(s.id)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </span>
      </template>
      <span v-else class="text-[12.5px] text-muted">Не в спринте</span>

      <button
        v-if="canEdit"
        type="button"
        class="inline-flex items-center gap-1.5 h-[26px] px-2.5 self-start rounded-md text-[12px] text-muted bg-transparent border border-dashed border-default cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
        @click="pickerOpen = true"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        В спринт
      </button>
    </div>

    <SprintPickerModal
      v-model:open="pickerOpen"
      :workspace-id="workspaceId"
      :board-id="boardId"
      :task-id="taskId"
      :task-title="taskTitle"
      :task-story-points="taskStoryPoints"
    />
  </TaskFocusPropRow>
</template>
