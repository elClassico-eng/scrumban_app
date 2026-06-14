<script setup lang="ts">
import { pageRoutes } from '~/routing'

defineProps<{ collapsed: boolean }>()

const authStore = useAuthStore()
const userName = computed(() => authStore.user ? displayName(authStore.user) : null)
const userInitials = computed(() => authStore.user ? initials(authStore.user) : '')
</script>

<template>
  <UTooltip
    v-if="authStore.user"
    :text="`${userName} — личный кабинет`"
    :disabled="!collapsed"
    :popper="{ placement: 'right' }"
  >
    <NuxtLink
      :to="pageRoutes.me"
      :class="[
        'm-3 flex items-center rounded-2xl border border-default bg-elevated transition-colors hover:border-[var(--ui-border-accented)]',
        collapsed ? 'justify-center p-2' : 'gap-3 p-2.5',
      ]"
    >
      <div class="relative shrink-0">
        <div class="grid size-9 place-items-center overflow-hidden rounded-full bg-default text-xs font-semibold text-default">
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
          class="absolute top-0 right-0 size-2.5 rounded-full bg-warning-500 ring-2 ring-[var(--ui-bg)]"
          title="Email не подтверждён"
        />
      </div>
      <div v-if="!collapsed" class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-highlighted">{{ userName }}</p>
        <p
          class="truncate text-xs"
          :class="authStore.user.emailVerifiedAt ? 'text-dimmed' : 'text-warning-600'"
        >
          {{ authStore.user.emailVerifiedAt ? 'Личный кабинет' : 'Подтвердите email' }}
        </p>
      </div>
      <UIcon
        v-if="!collapsed"
        name="i-lucide-more-horizontal"
        class="ml-auto size-4 shrink-0 text-dimmed"
      />
    </NuxtLink>
  </UTooltip>
</template>
