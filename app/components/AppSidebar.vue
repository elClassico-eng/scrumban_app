<script setup lang="ts">
import { pageRoutes } from '~/routing'

const links = [
  { label: 'Воркспейсы', icon: 'i-lucide-folder', to: pageRoutes.workspaces },
  { label: 'Доски', icon: 'i-lucide-kanban-square', to: pageRoutes.home },
  { label: 'Аналитика', icon: 'i-lucide-line-chart', to: pageRoutes.home },
]
</script>

<template>
  <aside class="w-60 border-r border-default bg-elevated flex flex-col">
    <div class="h-14 flex items-center px-6 border-b border-default">
      <NuxtLink :to="pageRoutes.home" class="font-bold tracking-tight text-lg">
        Scrumban
      </NuxtLink>
    </div>
    <nav class="flex-1 p-3 flex flex-col gap-1">
      <NuxtLink
        v-for="link in links"
        :key="link.label"
        :to="link.to"
        class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary"
      >
        <UIcon :name="link.icon" class="size-4" />
        {{ link.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>