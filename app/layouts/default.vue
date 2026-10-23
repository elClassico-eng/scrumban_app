<script setup lang="ts">
useNotificationsSse()
const { hint } = useGlobalShortcuts()
const { frame } = useSidebarPrefs()
</script>

<template>
  <div :class="['relative h-dvh flex overflow-clip app-canvas', frame === 'dark' ? 'app-canvas-dark' : 'app-canvas-light']">
    <div class="pointer-events-none absolute -top-40 -right-24 size-[40rem] rounded-full dark:bg-accent-500/15 blur-[130px]" />
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0 lg:py-2 lg:pr-2">
      <AppTopBar />
      <ControlCenter />
      <main class="flex-1 overflow-auto min-w-0 bg-default p-4 sm:p-6 pt-4 lg:pt-14 lg:rounded-2xl lg:border lg:border-default">
        <slot />
      </main>
    </div>
    <IntroduceModal />
    <HelpPanel />
    <ShortcutLeaderHint :hint="hint" />
  </div>
</template>