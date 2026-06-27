<script setup lang="ts">
import { pageRoutes } from '~/routing'

const uiStore = useUiStore()
const ccActions = useControlCenterActions()
const { unreadCount } = useNotificationsApi()

const unread = computed(() => unreadCount.data.value?.count ?? 0)
</script>

<template>
  <header
    class="lg:hidden flex items-center gap-2 h-14 shrink-0 px-3 border-b border-default bg-default"
  >
    <button
      type="button"
      class="size-10 grid place-items-center rounded-xl text-toned hover:bg-elevated transition-colors"
      aria-label="Меню"
      @click="uiStore.toggleMobileNav"
    >
      <UIcon name="i-lucide-menu" class="size-5" />
    </button>

    <NuxtLink :to="pageRoutes.workspaces" class="takt-logo flex min-w-0 items-center gap-2">
      <TaktMark class="size-6 shrink-0" />
      <span class="font-semibold tracking-tight truncate">Такт</span>
    </NuxtLink>

    <div class="flex-1" />

    <button
      type="button"
      class="size-10 grid place-items-center rounded-xl text-toned hover:bg-elevated transition-colors"
      aria-label="Поиск"
      @click="ccActions.requestSearch"
    >
      <UIcon name="i-lucide-search" class="size-5" />
    </button>

    <button
      type="button"
      class="relative size-10 grid place-items-center rounded-xl text-toned hover:bg-elevated transition-colors"
      aria-label="Центр управления"
      @click="uiStore.openControlCenter"
    >
      <UIcon name="i-lucide-bell" class="size-5" />
      <span
        v-if="unread > 0"
        class="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-accent-500 text-white text-[9px] font-bold grid place-items-center"
      >{{ unread > 9 ? '9+' : unread }}</span>
    </button>
  </header>
</template>
