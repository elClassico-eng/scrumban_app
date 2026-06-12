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

const tagClass = computed(() => {
  switch (props.task.serviceClass) {
    case 'expedite': return 'bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-400'
    case 'intangible': return 'bg-muted/40 text-dimmed'
    default: return 'bg-elevated text-toned'
  }
})

const dotClass = computed(() => {
  switch (props.task.serviceClass) {
    case 'expedite': return 'bg-accent-500'
    case 'intangible': return 'bg-dimmed'
    default: return 'bg-zinc-400 dark:bg-zinc-500'
  }
})

const items = computed(() =>
  SERVICE_CLASS_OPTIONS.map(o => ({
    label: SERVICE_CLASS_INFO[o.value].shortLabel,
    icon: props.task.serviceClass === o.value ? 'i-lucide-check' : undefined,
    onSelect: () => { if (props.task.serviceClass !== o.value) update.mutate({ taskId: props.task.id, serviceClass: o.value }) },
  })),
)
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-44' }">
    <button
      class="inline-flex items-center gap-[6px] h-[24px] px-[10px] rounded-[7px] text-[12px] font-medium transition-opacity hover:opacity-80"
      :class="tagClass"
    >
      <span class="size-[6px] rounded-full shrink-0" :class="dotClass" />
      {{ cos.shortLabel }}
    </button>
  </UDropdownMenu>
  <span
    v-else
    class="inline-flex items-center gap-[6px] h-[24px] px-[10px] rounded-[7px] text-[12px] font-medium"
    :class="tagClass"
  >
    <span class="size-[6px] rounded-full shrink-0" :class="dotClass" />
    {{ cos.shortLabel }}
  </span>
</template>
