<script setup lang="ts">
useNotificationsSse()
</script>

<template>
  <div class="relative h-dvh flex overflow-hidden">
    <div class="pointer-events-none absolute -top-40 -right-24 size-[40rem] rounded-full dark:bg-accent-500/15 blur-[130px]" />
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppTopBar />
      <ControlCenter />
      <main class="flex-1 overflow-auto p-4 sm:p-6 pt-4 lg:pt-14 min-w-0">
        <slot />
      </main>
    </div>
    <IntroduceModal />
    <CommandPalette />
  </div>
</template>