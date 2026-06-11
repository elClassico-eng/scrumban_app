<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  task: Task
  assignees: MemberView[]
  members: MemberView[]
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()

const { add, remove } = useTaskAssigneesApi(
  toRef(props, 'workspaceId'),
  toRef(props, 'boardId'),
  toRef(() => props.task.id),
  { enabled: false },
)

const assignedIds = computed(() => new Set(props.task.assigneeIds ?? []))
const items = computed(() =>
  props.members.map(m => ({
    label: displayName(m),
    icon: assignedIds.value.has(m.userId) ? 'i-lucide-check' : undefined,
    onSelect: () => {
      if (assignedIds.value.has(m.userId)) remove.mutate(m.userId)
      else add.mutate({ userId: m.userId })
    },
  })),
)
</script>

<template>
  <UDropdownMenu v-if="canEdit" :items="items" :ui="{ content: 'w-56 max-h-64 overflow-auto' }">
    <button class="flex items-center rounded hover:bg-elevated px-1 py-0.5">
      <template v-if="assignees.length > 0">
        <UserAvatar v-for="(m, i) in assignees" :key="m.userId" :user="m" size="sm" ring :class="i > 0 ? '-ml-[7px]' : ''" />
      </template>
      <span v-else class="size-6 rounded-full border border-dashed border-default text-dimmed grid place-items-center">
        <UIcon name="i-lucide-user" class="size-3" />
      </span>
    </button>
  </UDropdownMenu>
  <span v-else class="flex items-center">
    <template v-if="assignees.length > 0">
      <UserAvatar v-for="(m, i) in assignees" :key="m.userId" :user="m" size="sm" ring tooltip :class="i > 0 ? '-ml-[7px]' : ''" />
    </template>
    <span v-else class="size-6 rounded-full border border-dashed border-default text-dimmed grid place-items-center">
      <UIcon name="i-lucide-user" class="size-3" />
    </span>
  </span>
</template>
