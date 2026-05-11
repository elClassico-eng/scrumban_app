<script setup lang="ts">
import { pageRoutes } from '~/routing'

defineProps<{
  workspaceId: string
  boardId: string
  boardName: string | undefined
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 pb-3 border-b border-default">
    <div class="flex items-center gap-3 min-w-0">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        class="text-sm text-muted hover:text-default flex items-center gap-1 shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        К доскам
      </NuxtLink>
      <h1 class="text-xl font-bold tracking-tight truncate">{{ boardName ?? 'Доска' }}</h1>
    </div>
    <nav class="flex gap-1 shrink-0">
      <NuxtLink
        :to="pageRoutes.board(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Доска
      </NuxtLink>
      <NuxtLink
        :to="pageRoutes.boardSprints(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Спринты
      </NuxtLink>
      <NuxtLink
        :to="pageRoutes.boardAnalytics(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Аналитика
      </NuxtLink>
    </nav>
  </div>
</template>
