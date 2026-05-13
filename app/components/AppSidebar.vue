<script setup lang="ts">
import { pageRoutes } from '~/routing'

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const { list } = useWorkspacesApi()

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const current = computed(() => {
  const id = workspaceStore.currentId
  return workspaces.value.find(w => w.id === id) ?? workspaces.value[0] ?? null
})

const links = computed(() => {
  const out: Array<{ label: string; icon: string; to: string }> = [
    { label: 'Все workspaces', icon: 'i-lucide-folder', to: pageRoutes.workspaces },
  ]
  if (current.value) {
    out.push(
      { label: 'Доски', icon: 'i-lucide-kanban-square', to: pageRoutes.boards(current.value.id) },
      { label: 'Участники', icon: 'i-lucide-users', to: pageRoutes.workspaceMembers(current.value.id) },
    )
    if (hasRole(current.value.role, 'admin')) {
      out.push({
        label: 'Настройки',
        icon: 'i-lucide-settings',
        to: pageRoutes.workspaceSettings(current.value.id),
      })
    }
  }
  return out
})

const userName = computed(() => authStore.user ? displayName(authStore.user) : null)
const userInitials = computed(() => authStore.user ? initials(authStore.user) : '')
</script>

<template>
  <aside class="glass w-60 flex flex-col border-r-0">
    <div class="h-14 flex items-center px-6">
      <NuxtLink :to="pageRoutes.home" class="font-bold tracking-tight text-lg">
        Scrumban
      </NuxtLink>
    </div>

    <WorkspaceSwitcher />

    <nav class="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
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

    <!-- User identity card pinned at the bottom; clicking opens /me. -->
    <NuxtLink
      v-if="authStore.user"
      :to="pageRoutes.me"
      class="m-3 p-3 rounded-lg flex items-center gap-3 hover:bg-accented/60 transition-colors"
      :title="`${userName} — личный кабинет`"
    >
      <div
        class="size-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden"
      >
        <img
          v-if="authStore.user.avatarUrl"
          :src="authStore.user.avatarUrl"
          alt=""
          class="size-full object-cover"
        >
        <span v-else>{{ userInitials }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-default truncate">{{ userName }}</p>
        <p class="text-xs text-muted truncate">Личный кабинет</p>
      </div>
    </NuxtLink>
  </aside>
</template>