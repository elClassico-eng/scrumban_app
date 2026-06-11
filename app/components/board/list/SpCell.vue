<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{
  task: Task
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()

const { update } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))
const POINTS = [1, 2, 3, 5, 8, 13]

const items = computed(() => [
  ...POINTS.map(p => ({
    label: String(p),
    icon: props.task.storyPoints === p ? 'i-lucide-check' : undefined,
    onSelect: () => update.mutate({ taskId: props.task.id, storyPoints: p }),
  })),
  {
    label: 'Без оценки',
    icon: props.task.storyPoints == null ? 'i-lucide-check' : undefined,
    onSelect: () => update.mutate({ taskId: props.task.id, storyPoints: null }),
  },
])
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-32' }">
    <button class="font-mono text-xs font-semibold tabular-nums px-1.5 rounded hover:bg-elevated" :class="task.storyPoints == null ? 'text-dimmed' : 'text-toned'">
      {{ task.storyPoints == null ? '—' : task.storyPoints }}
    </button>
  </UDropdownMenu>
  <span v-else class="font-mono text-xs font-semibold tabular-nums" :class="task.storyPoints == null ? 'text-dimmed' : 'text-toned'">
    {{ task.storyPoints == null ? '—' : task.storyPoints }}
  </span>
</template>
