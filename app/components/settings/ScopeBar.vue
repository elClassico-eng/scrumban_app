<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const { me } = useProfileApi()
const { list } = useWorkspacesApi()
const workspaces = computed(() => list.data.value?.workspaces ?? [])
const user = computed(() => me.data.value?.user ?? null)
const openId = computed(() => route.params.id as string | undefined)

function chipClass(active: boolean) {
  return active
    ? 'bg-accent-500/10 text-default ring-1 ring-accent-500'
    : 'bg-zinc-100 text-muted hover:bg-zinc-200/70 hover:text-default dark:bg-elevated/60 dark:hover:bg-elevated'
}
</script>

<template>
  <nav class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Что настраиваем">
    <NuxtLink
      :to="pageRoutes.settings()"
      class="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-medium transition-colors"
      :class="chipClass(!openId)"
      :aria-current="!openId ? 'page' : undefined"
    >
      <UserAvatar v-if="user" :user="user" size="xs" />
      Личные настройки
    </NuxtLink>
    <NuxtLink
      v-for="ws in workspaces"
      :key="ws.id"
      :to="pageRoutes.workspaceSettings(ws.id)"
      class="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-medium transition-colors"
      :class="chipClass(openId === ws.id)"
      :aria-current="openId === ws.id ? 'page' : undefined"
    >
      <WorkspaceAvatar :name="ws.name" :logo-url="ws.logoUrl" size="xs" class="rounded-full" />
      {{ ws.name }}
    </NuxtLink>
  </nav>
</template>
