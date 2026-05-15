<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{ task: Task; workspaceId: string }>()

const router = useRouter()
const route = useRoute()
function openTask() {
  router.push({
    path: route.path,
    query: { ...route.query, task: props.task.id },
  })
}

// vue-query dedupes by queryKey, so even though every card calls these
// composables, only one HTTP request hits each endpoint per board.
const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.task.boardId)
const { list: membersList } = useMembersApi(wsId)
const { list: boardsList } = useBoardsApi(wsId)
const { byTaskId: depCountsByTaskId } = useBoardDependencyCountsApi(wsId, bId)

const cosInfo = computed(() => SERVICE_CLASS_INFO[props.task.serviceClass])
const blockerCount = computed(() => depCountsByTaskId.value.get(props.task.id)?.blockerCount ?? 0)

const assignee = computed(() => {
  if (!props.task.assigneeId) return null
  return membersList.data.value?.members.find(m => m.userId === props.task.assigneeId) ?? null
})
const assigneeName = computed(() => assignee.value ? displayName(assignee.value) : null)
const assigneeInitials = computed(() => assignee.value ? initials(assignee.value) : '')

// Aging-WIP signal: age from createdAt vs board.sleDays.
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
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <span
          :class="['size-2 rounded-full shrink-0 mt-1.5', cosInfo.dotClass]"
          :title="cosInfo.shortLabel"
        />
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
            title="Эпик"
          />
          <p class="text-sm font-medium line-clamp-2 flex-1 min-w-0">{{ task.title }}</p>
        </div>
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
    <div class="flex items-center justify-between gap-2 min-h-6 pl-4">
      <div class="flex items-center gap-3 text-xs text-muted min-w-0">
        <span
          v-if="dueDateLabel"
          class="inline-flex items-center gap-1 shrink-0"
          :class="dueOverdue ? 'text-error font-medium' : ''"
          :title="dueOverdue ? 'Дедлайн просрочен' : 'Дедлайн'"
        >
          <UIcon name="i-lucide-calendar" class="size-3.5" />
          {{ dueDateLabel }}
        </span>
        <span
          v-if="blockerCount > 0"
          class="inline-flex items-center gap-1 shrink-0 text-warning"
          :title="`Заблокирована ${blockerCount} задачами`"
        >
          <UIcon name="i-lucide-lock" class="size-3.5" />
          {{ blockerCount }}
        </span>
      </div>
      <UserAvatar
        v-if="assignee"
        :user="assignee"
        size="sm"
        tooltip
      />
    </div>
  </div>
</template>
