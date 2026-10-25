<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{
  task: Task
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()

const { update } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))

const items = computed(() => [
  ...STORY_POINTS_OPTIONS.map(p => ({
    label: String(p),
    icon: props.task.storyPoints === p ? 'i-hugeicons-check' : undefined,
    onSelect: () => { if (props.task.storyPoints !== p) update.mutate({ taskId: props.task.id, storyPoints: p }) },
  })),
  {
    label: 'Без оценки',
    icon: props.task.storyPoints == null ? 'i-hugeicons-check' : undefined,
    onSelect: () => { if (props.task.storyPoints != null) update.mutate({ taskId: props.task.id, storyPoints: null }) },
  },
])
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-32' }">
    <button
      class="font-mono text-[12px] font-semibold tabular-nums min-w-[26px] h-[24px] px-[7px] rounded-[7px] inline-grid place-items-center transition-opacity hover:opacity-80"
      :class="task.storyPoints == null ? 'bg-transparent text-[11px] text-dimmed opacity-50 transition-opacity group-hover:opacity-100' : 'text-toned bg-elevated'"
      :title="task.storyPoints == null ? 'Оценить в SP' : undefined"
    >
      {{ task.storyPoints == null ? 'SP' : task.storyPoints }}
    </button>
  </UDropdownMenu>
  <span
    v-else-if="task.storyPoints != null"
    class="font-mono text-[12px] font-semibold tabular-nums min-w-[26px] h-[24px] px-[7px] rounded-[7px] inline-grid place-items-center text-toned bg-elevated"
  >
    {{ task.storyPoints }}
  </span>
</template>
