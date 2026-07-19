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
  <aside class="xl:sticky xl:top-4 min-w-0">
    <div
      class="flex flex-col rounded-2xl border border-default bg-default overflow-hidden xl:max-h-[calc(100dvh-11rem)]"
    >
      <div class="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
        <UIcon name="i-lucide-activity" class="size-4 text-accent-500" />
        <span class="text-[13px] font-semibold tracking-tight text-default">Пульс спринтов</span>
      </div>

      <div class="px-4 pb-4 space-y-5 shrink-0 border-b border-default">
        <SprintSidebarSummary :sprints="sprints" />

        <template v-if="hasActiveSprint">
          <div class="h-px bg-default" />
          <SprintSidebarAttention
            :workspace-id="workspaceId"
            :board-id="boardId"
            :has-active-sprint="hasActiveSprint"
          />
        </template>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <SprintSidebarActivityFeed
          :workspace-id="workspaceId"
          :board-id="boardId"
        />
      </div>
    </div>
  </aside>
</template>
