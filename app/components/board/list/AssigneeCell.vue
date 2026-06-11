<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
defineProps<{
  task: Task
  assignees: MemberView[]
  members: MemberView[]
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()
</script>

<template>
  <span v-if="assignees.length > 0" class="flex items-center">
    <UserAvatar
      v-for="(m, i) in assignees" :key="m.userId" :user="m" size="sm" ring tooltip
      :class="i > 0 ? '-ml-1.5' : ''"
    />
  </span>
  <span v-else class="size-6 rounded-full border border-dashed border-default text-dimmed grid place-items-center">
    <UIcon name="i-lucide-user" class="size-3" />
  </span>
</template>
