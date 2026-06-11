<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

type GroupBy = 'none' | 'assignee' | 'service_class' | 'epic'
type DepCount = { blockerCount: number, blockedCount: number }

defineProps<{
  tasks: Task[]
  groupBy: GroupBy
  columns: Column[]
  members: MemberView[]
  depCounts: Map<string, DepCount>
  canCreate: boolean
  workspaceId: string
  boardId: string
}>()
</script>

<template>
  <div class="overflow-auto pt-3.5 px-6 pb-10">
    <div class="max-w-[1380px] mx-auto text-sm text-muted">
      Список (заглушка)
    </div>
  </div>
</template>
