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
    icon: props.task.storyPoints === p ? 'i-lucide-check' : undefined,
    onSelect: () => { if (props.task.storyPoints !== p) update.mutate({ taskId: props.task.id, storyPoints: p }) },
  })),
  {
    label: 'Без оценки',
    icon: props.task.storyPoints == null ? 'i-lucide-check' : undefined,
    onSelect: () => { if (props.task.storyPoints != null) update.mutate({ taskId: props.task.id, storyPoints: null }) },
  },
])
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-32' }">
    <button
      class="font-mono text-[12px] font-semibold tabular-nums min-w-[26px] h-[24px] px-[7px] rounded-[7px] inline-grid place-items-center transition-opacity hover:opacity-80"
      :class="task.storyPoints == null ? 'text-dimmed bg-transparent' : 'text-toned bg-elevated'"
    >
      {{ task.storyPoints == null ? '—' : task.storyPoints }}
    </button>
  </UDropdownMenu>
  <span
    v-else
    class="font-mono text-[12px] font-semibold tabular-nums min-w-[26px] h-[24px] px-[7px] rounded-[7px] inline-grid place-items-center"
    :class="task.storyPoints == null ? 'text-dimmed' : 'text-toned bg-elevated'"
  >
    {{ task.storyPoints == null ? '—' : task.storyPoints }}
  </span>
</template>
