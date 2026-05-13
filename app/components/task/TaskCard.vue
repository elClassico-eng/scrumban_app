<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { ServiceClass } from '#shared/types/domain'
const props = defineProps<{ task: Task; workspaceId: string }>()

const router = useRouter()
const route = useRoute()
function openTask() {
  router.push({
    path: route.path,
    query: { ...route.query, task: props.task.id },
  })
}

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

// vue-query dedupes by queryKey, so even though every card calls these
// composables, only one HTTP request hits each endpoint per board.
const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.task.boardId)
const { list: membersList } = useMembersApi(wsId)
const { list: boardsList } = useBoardsApi(wsId)
const { byTaskId: depCountsByTaskId } = useBoardDependencyCountsApi(wsId, bId)

const depCounts = computed(() => depCountsByTaskId.value.get(props.task.id) ?? null)

const assigneeEmail = computed(() => {
  if (!props.task.assigneeId) return null
  const found = membersList.data.value?.members.find(m => m.userId === props.task.assigneeId)
  return found?.email ?? null
})

// Aging-WIP visual signal: ages from createdAt vs board.sleDays.
// Per-column anchor is Phase 8 work.
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === props.task.boardId) ?? null,
)
const agingTier = computed(() =>
  getAgingTier(ageDaysFromIso(props.task.createdAt), board.value?.sleDays ?? null),
)
const agingTooltip = computed(() => {
  if (agingTier.value.level === 'fresh') return undefined
  const days = ageDaysFromIso(props.task.createdAt).toFixed(1)
  return `Возраст ${days} дн (SLE ${board.value?.sleDays} дн)`
})

// Due date is shown on the card whenever set, regardless of CoS. Fixed-date
// tasks REQUIRE it; other classes may have it as a soft target.
const dueDateLabel = computed(() => {
  if (!props.task.dueDate) return null
  return new Date(props.task.dueDate).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
})
const dueOverdue = computed(() => {
  if (!props.task.dueDate) return false
  return new Date(props.task.dueDate).getTime() < Date.now()
})
</script>

<template>
  <div
    class="bg-default border border-default rounded-lg p-3 cursor-grab hover:border-primary/50 hover:shadow-sm transition-all space-y-2"
    @click="openTask"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-start gap-1.5 min-w-0 flex-1">
        <UIcon
          v-if="task.blockedReason"
          name="i-lucide-lock"
          class="size-3.5 text-warning mt-0.5 shrink-0"
          :title="`Заблокировано: ${task.blockedReason}`"
        />
        <UIcon
          v-if="task.isEpic"
          name="i-lucide-flag"
          class="size-3.5 text-primary mt-0.5 shrink-0"
          title="Epic"
        />
        <p class="text-sm font-medium line-clamp-2 flex-1 min-w-0">{{ task.title }}</p>
      </div>
      <span
        v-if="agingTier.show"
        :class="[
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 leading-none',
          agingTier.chipClass,
        ]"
        :title="agingTooltip"
      >
        <UIcon name="i-lucide-clock" class="size-3" />
        {{ Math.round(ageDaysFromIso(task.createdAt)) }}д
      </span>
    </div>
    <div class="flex items-center justify-between gap-2 min-h-6">
      <div class="flex items-center gap-1.5 flex-wrap">
        <UBadge
          v-if="cosVisual.icon && cosVisual.color"
          :color="cosVisual.color"
          variant="subtle"
          size="xs"
          :icon="cosVisual.icon"
          :title="cosVisual.label"
        >
          {{ cosVisual.label }}
        </UBadge>
        <UBadge
          v-if="dueDateLabel"
          :color="dueOverdue ? 'error' : 'neutral'"
          variant="subtle"
          size="xs"
          icon="i-lucide-calendar"
          :title="dueOverdue ? 'Дедлайн просрочен' : 'Дедлайн'"
        >
          {{ dueDateLabel }}
        </UBadge>
        <UBadge
          v-if="depCounts && depCounts.blockerCount > 0"
          color="warning"
          variant="subtle"
          size="xs"
          icon="i-lucide-lock"
          :title="`Заблокирована ${depCounts.blockerCount} задачами`"
        >
          {{ depCounts.blockerCount }}
        </UBadge>
        <UBadge
          v-if="depCounts && depCounts.blockedCount > 0"
          color="neutral"
          variant="subtle"
          size="xs"
          icon="i-lucide-link"
          :title="`Блокирует ${depCounts.blockedCount} задач`"
        >
          {{ depCounts.blockedCount }}
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