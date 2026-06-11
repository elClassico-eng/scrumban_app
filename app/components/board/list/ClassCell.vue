<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{
  task: Task
  cos: { shortLabel: string, dotClass: string }
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()

const { update } = useTasksApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))

const items = computed(() =>
  SERVICE_CLASS_OPTIONS.map(o => ({
    label: SERVICE_CLASS_INFO[o.value].shortLabel,
    icon: props.task.serviceClass === o.value ? 'i-lucide-check' : undefined,
    onSelect: () => update.mutate({ taskId: props.task.id, serviceClass: o.value }),
  })),
)
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-44' }">
    <button class="inline-flex items-center gap-1.5 text-xs px-1.5 rounded hover:bg-elevated" :class="task.serviceClass === 'expedite' ? 'text-accent-600 font-semibold' : task.serviceClass === 'intangible' ? 'text-muted' : 'text-toned'">
      <span class="size-1.5 rounded-full" :class="cos.dotClass" />
      {{ cos.shortLabel }}
    </button>
  </UDropdownMenu>
  <span v-else class="inline-flex items-center gap-1.5 text-xs" :class="task.serviceClass === 'expedite' ? 'text-accent-600 font-semibold' : task.serviceClass === 'intangible' ? 'text-muted' : 'text-toned'">
    <span class="size-1.5 rounded-full" :class="cos.dotClass" />
    {{ cos.shortLabel }}
  </span>
</template>
