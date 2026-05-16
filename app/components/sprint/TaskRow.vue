<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  task: Task
  column: BoardColumn | null
  members: MemberView[]
  addedAfterStart?: boolean
}>()

const COLUMN_DOT: Record<string, string> = {
  backlog: 'bg-zinc-300',
  todo: 'bg-zinc-500',
  in_progress: 'bg-accent-500',
  review: 'bg-violet-500',
  done: 'bg-emerald-500',
}

const dotClass = computed(() => {
  if (!props.column) return 'bg-zinc-300'
  return COLUMN_DOT[props.column.columnRole] ?? 'bg-zinc-300'
})

const columnLabel = computed(() => props.column?.name ?? '—')

const CLASS_BADGE: Partial<Record<Task['serviceClass'], { label: string; className: string }>> = {
  expedite: { label: 'Срочная', className: 'bg-accent-500 text-white' },
  intangible: { label: 'Фон', className: 'bg-zinc-100 text-zinc-500' },
  fixed_date: { label: 'С дедлайном', className: 'bg-amber-50 text-amber-700' },
}

const classBadge = computed(() => CLASS_BADGE[props.task.serviceClass] ?? null)

const memberById = computed(() => {
  const m = new Map<string, MemberView>()
  for (const member of props.members) m.set(member.userId, member)
  return m
})

const assignees = computed(() =>
  props.task.assigneeIds
    .slice(0, 3)
    .map(id => memberById.value.get(id))
    .filter((m): m is MemberView => !!m),
)
const hiddenAssigneesCount = computed(() =>
  Math.max(0, props.task.assigneeIds.length - assignees.value.length),
)

const router = useRouter()
const route = useRoute()
function openTask() {
  router.push({
    path: route.path,
    query: { ...route.query, task: props.task.id },
  })
}
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-2.5 px-3 py-2 text-left bg-white hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-b-0 cursor-pointer"
    :class="addedAfterStart ? 'ring-1 ring-accent-100 ring-inset' : ''"
    :title="addedAfterStart ? 'Добавлена после старта спринта' : column?.name"
    @click="openTask"
  >
    <span class="size-2 rounded-full shrink-0" :class="dotClass" :title="columnLabel" />
    <span class="text-[11px] font-mono text-muted shrink-0">
      {{ task.id.slice(0, 8).toUpperCase() }}
    </span>
    <span class="flex-1 text-[13px] text-default truncate">
      {{ task.title }}
    </span>
    <span
      v-if="classBadge"
      class="text-[10.5px] font-medium px-1.5 py-0.5 rounded shrink-0"
      :class="classBadge.className"
    >
      {{ classBadge.label }}
    </span>
    <span v-if="task.storyPoints != null" class="text-[11.5px] text-muted shrink-0">
      <b class="text-default font-semibold">{{ task.storyPoints }}</b> SP
    </span>
    <div class="flex items-center -space-x-1.5 shrink-0">
      <UserAvatar
        v-for="member in assignees"
        :key="member.userId"
        :user="member"
        size="xs"
        ring
        tooltip
      />
      <div
        v-if="hiddenAssigneesCount > 0"
        class="size-5 rounded-full bg-zinc-200 text-zinc-600 text-[9px] font-medium flex items-center justify-center ring-2 ring-white"
      >
        +{{ hiddenAssigneesCount }}
      </div>
      <span
        v-if="assignees.length === 0 && hiddenAssigneesCount === 0"
        class="size-5 rounded-full bg-zinc-100 text-zinc-400 text-[10px] flex items-center justify-center"
        title="Без исполнителя"
      >·</span>
    </div>
  </button>
</template>
