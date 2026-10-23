<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { sidebarFade } from '~/utils/sidebar-items'

defineProps<{ collapsed: boolean }>()

const authStore = useAuthStore()
const userName = computed(() => authStore.user ? displayName(authStore.user) : null)
const userInitials = computed(() => authStore.user ? initials(authStore.user) : '')
</script>

<template>
  <div v-if="authStore.user" class="px-2 pb-3 pt-2">
    <UTooltip :text="`${userName} – личный кабинет`" :disabled="!collapsed" :content="{ side: 'right' }">
      <NuxtLink
        :to="pageRoutes.me"
        :class="[
          'flex items-center gap-3 overflow-hidden rounded-2xl border py-1.5 pl-[5px] pr-2.5 transition-colors',
          collapsed ? 'border-transparent duration-75 hover:bg-elevated' : 'border-default bg-elevated duration-200 hover:border-[var(--ui-border-accented)]',
        ]"
      >
        <div class="relative shrink-0">
          <div class="grid size-7 place-items-center overflow-hidden rounded-full bg-accented text-[10px] font-semibold text-default">
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
            class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warning-500 ring-2 ring-[var(--ui-bg)]"
            title="Email не подтверждён"
          />
        </div>
        <div :class="['min-w-0 flex-1', sidebarFade(collapsed)]">
          <p class="truncate text-sm font-semibold text-highlighted">{{ userName }}</p>
          <p
            class="truncate text-xs"
            :class="authStore.user.emailVerifiedAt ? 'text-dimmed' : 'text-warning-600'"
          >
            {{ authStore.user.emailVerifiedAt ? 'Личный кабинет' : 'Подтвердите email' }}
          </p>
        </div>
        <UIcon name="i-hugeicons-more-horizontal" :class="['size-4 shrink-0 text-dimmed', sidebarFade(collapsed)]" />
      </NuxtLink>
    </UTooltip>
  </div>
</template>
