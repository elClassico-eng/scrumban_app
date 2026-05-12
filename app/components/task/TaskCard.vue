<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { ServiceClass } from '#shared/types/domain'

const props = defineProps<{ task: Task; workspaceId: string }>()

const boardStore = useBoardStore()

interface CosVisual {
  icon: string | null
  color: 'error' | 'warning' | 'neutral' | null
  label: string
}
const COS_CONFIG: Record<ServiceClass, CosVisual> = {
  expedite: { icon: 'i-lucide-zap', color: 'error', label: 'Expedite' },
  fixed_date: { icon: 'i-lucide-calendar-clock', color: 'warning', label: 'Fixed date' },
  standard: { icon: null, color: null, label: 'Standard' },
  intangible: { icon: 'i-lucide-arrow-down-narrow-wide', color: 'neutral', label: 'Intangible' },
}

const cosVisual = computed(() => COS_CONFIG[props.task.serviceClass])

// vue-query dedupes by queryKey, so even though every card calls this
// composable, only one HTTP request hits the members endpoint per board.
const wsId = computed(() => props.workspaceId)
const { list: membersList } = useMembersApi(wsId)

const assigneeEmail = computed(() => {
  if (!props.task.assigneeId) return null
  const found = membersList.data.value?.members.find(m => m.userId === props.task.assigneeId)
  return found?.email ?? null
})

// Formatted due date for fixed_date tasks; null otherwise.
const dueDateLabel = computed(() => {
  if (props.task.serviceClass !== 'fixed_date' || !props.task.dueDate) return null
  return new Date(props.task.dueDate).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
})
</script>

<template>
  <div
    class="bg-default border border-default rounded-lg p-3 cursor-grab hover:border-primary/50 hover:shadow-sm transition-all space-y-2"
    @click="boardStore.openTask(task.id)"
  >
    <p class="text-sm font-medium line-clamp-2">{{ task.title }}</p>
    <div class="flex items-center justify-between gap-2 min-h-6">
      <div class="flex items-center gap-1.5">
        <UBadge
          v-if="cosVisual.icon && cosVisual.color"
          :color="cosVisual.color"
          variant="subtle"
          size="xs"
          :icon="cosVisual.icon"
          :title="cosVisual.label"
        >
          {{ dueDateLabel ?? cosVisual.label }}
        </UBadge>
      </div>
      <div
        v-if="assigneeEmail"
        class="size-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center uppercase shrink-0"
        :title="assigneeEmail"
      >
        {{ assigneeEmail.slice(0, 1) }}
      </div>
    </div>
  </div>
</template>