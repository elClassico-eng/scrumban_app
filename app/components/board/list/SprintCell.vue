<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{
  task: Task
  workspaceId: string
  boardId: string
}>()

const { memberships } = useTaskSprintMembership(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
  computed(() => props.task.id),
)

const sprint = computed(() =>
  memberships.value.find(s => s.state === 'active') ?? memberships.value[0] ?? null,
)
</script>

<template>
  <span
    v-if="sprint"
    class="inline-flex items-center gap-1.5 max-w-full text-[12px] text-toned"
    :title="sprint.name"
  >
    <span
      class="size-1.5 rounded-full shrink-0"
      :class="sprint.state === 'active' ? 'bg-emerald-500' : 'bg-accented'"
    />
    <span class="truncate">{{ sprint.name }}</span>
  </span>
  <span v-else class="text-dimmed text-xs">—</span>
</template>
