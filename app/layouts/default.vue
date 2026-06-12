<script setup lang="ts">
useNotificationsSse()
</script>

<template>
  <div class="relative h-screen flex overflow-hidden">
    <div class="pointer-events-none absolute -top-40 -right-24 size-[40rem] rounded-full dark:bg-accent-500/15 blur-[130px]" />
    <div class="pointer-events-none fixed -top-2 left-1/2 -translate-x-1/2 z-[90] w-[380px] h-[84px] rounded-full bg-accent-500/35 dark:bg-accent-500/40 blur-xl" />
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <ControlCenter />
      <main class="flex-1 overflow-auto p-6 pt-14 min-w-0">
        <slot />
      </main>
    </div>
    <IntroduceModal />
    <CommandPalette />
  </div>
</template>