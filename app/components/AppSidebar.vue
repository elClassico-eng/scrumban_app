<script setup lang="ts">
import { pageRoutes } from '~/routing'

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { list } = useWorkspacesApi()

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const current = computed(() => {
  const id = workspaceStore.currentId
  return workspaces.value.find(w => w.id === id) ?? workspaces.value[0] ?? null
})

const collapsed = computed(() => uiStore.sidebarCollapsed)

const links = computed(() => {
  const out: Array<{ label: string; icon: string; to: string }> = [
    { label: 'Все workspaces', icon: 'i-lucide-folder', to: pageRoutes.workspaces },
  ]
  if (current.value) {
    out.push(
      { label: 'Доски', icon: 'i-lucide-kanban-square', to: pageRoutes.boards(current.value.id) },
      { label: 'Участники', icon: 'i-lucide-users', to: pageRoutes.workspaceMembers(current.value.id) },
      { label: 'Активность', icon: 'i-lucide-activity', to: pageRoutes.workspaceActivity(current.value.id) },
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
  <aside
    :class="[
      'm-3 rounded-2xl flex flex-col overflow-hidden shadow-sm transition-[width,background-color,color] duration-300 ease-out',
      collapsed
        ? 'w-16 bg-black text-white'
        : 'w-60 bg-white text-default',
    ]"
  >
    <div
      :class="[
        'h-14 flex items-center transition-[padding] duration-300',
        collapsed ? 'justify-center px-0' : 'justify-between px-6',
      ]"
    >
      <NuxtLink
        v-if="!collapsed"
        :to="pageRoutes.home"
        class="font-bold tracking-tight text-lg transition-opacity duration-200"
      >
        Scrumban
      </NuxtLink>
      <button
        type="button"
        :class="[
          'rounded-md p-1.5 transition-colors',
          collapsed
            ? 'hover:bg-white/10'
            : 'hover:bg-[#f4f4f4]',
        ]"
        :title="collapsed ? 'Развернуть' : 'Свернуть'"
        @click="uiStore.toggleSidebar"
      >
        <UIcon
          :name="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
          class="size-4"
        />
      </button>
    </div>

    <Transition
      enter-active-class="transition-opacity duration-200 delay-200"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <WorkspaceSwitcher v-if="!collapsed" />
    </Transition>

    <nav class="flex-1 p-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
      <UTooltip
        v-for="link in links"
        :key="link.label"
        :text="link.label"
        :disabled="!collapsed"
        :popper="{ placement: 'right' }"
      >
        <NuxtLink
          :to="link.to"
          :class="[
            'flex items-center gap-3 rounded-md text-sm transition-colors',
            collapsed
              ? 'justify-center p-2.5 text-white/70 hover:bg-white/10 hover:text-white'
              : 'px-3 py-2 text-muted hover:bg-[#f4f4f4] hover:text-default',
          ]"
          :active-class="
            collapsed
              ? '!bg-white/15 !text-white'
              : '!bg-accent-50 !text-accent-700 font-medium'
          "
        >
          <UIcon :name="link.icon" class="size-4 shrink-0" />
          <span
            :class="[
              'truncate transition-opacity duration-200',
              collapsed ? 'opacity-0 hidden' : 'opacity-100',
            ]"
          >
            {{ link.label }}
          </span>
        </NuxtLink>
      </UTooltip>
    </nav>

    <!-- User identity card pinned at the bottom; clicking opens /me. -->
    <UTooltip
      v-if="authStore.user"
      :text="`${userName} — личный кабинет`"
      :disabled="!collapsed"
      :popper="{ placement: 'right' }"
    >
      <NuxtLink
        :to="pageRoutes.me"
        :class="[
          'm-3 rounded-lg flex items-center transition-colors',
          collapsed
            ? 'justify-center p-2 hover:bg-white/10'
            : 'p-3 gap-3 hover:bg-[#f4f4f4]',
        ]"
      >
        <div class="relative shrink-0">
          <div
            :class="[
              'size-9 rounded-full text-xs font-semibold flex items-center justify-center overflow-hidden transition-colors',
              collapsed ? 'bg-white/10 text-white' : 'bg-[#f4f4f4] text-default',
            ]"
          >
            <img
              v-if="authStore.user.avatarUrl"
              :src="authStore.user.avatarUrl"
              alt=""
              class="size-full object-cover"
            >
            <span v-else>{{ userInitials }}</span>
          </div>
          <span
            v-if="!authStore.user.emailVerifiedAt"
            class="absolute top-0 right-0 size-2.5 rounded-full bg-warning-500 ring-2"
            :class="collapsed ? 'ring-zinc-900' : 'ring-white'"
            title="Email не подтверждён"
          />
        </div>
        <div
          v-if="!collapsed"
          class="flex-1 min-w-0 transition-opacity duration-200"
        >
          <p class="text-sm font-medium text-default truncate">{{ userName }}</p>
          <p
            class="text-xs truncate"
            :class="authStore.user.emailVerifiedAt ? 'text-muted' : 'text-warning-600'"
          >
            {{ authStore.user.emailVerifiedAt ? 'Личный кабинет' : 'Подтвердите email' }}
          </p>
        </div>
      </NuxtLink>
    </UTooltip>
  </aside>
</template>