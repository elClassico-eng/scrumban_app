<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  workspaceId: string
  boardId: string
  sprints: Sprint[]
}>()

const hasActiveSprint = computed(() => props.sprints.some(s => s.state === 'active'))
</script>

<template>
  <aside class="xl:sticky xl:top-4 space-y-6 min-w-0">
    <SprintSidebarSummary :sprints="sprints" />

    <div class="h-px bg-default" />

    <SprintSidebarAttention
      :workspace-id="workspaceId"
      :board-id="boardId"
      :has-active-sprint="hasActiveSprint"
    />

    <div v-if="hasActiveSprint" class="h-px bg-default" />

    <SprintSidebarActivityFeed
      :workspace-id="workspaceId"
      :board-id="boardId"
    />
  </aside>
</template>
