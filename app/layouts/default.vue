<script setup lang="ts">
useNotificationsSse()
</script>

<template>
  <div class="relative h-screen flex overflow-hidden">
    <div class="pointer-events-none absolute -top-40 -right-24 size-[40rem] rounded-full dark:bg-accent-500/15 blur-[130px]" />
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <ControlCenter />
      <main class="flex-1 overflow-auto p-6 pt-[84px] min-w-0">
        <slot />
      </main>
    </div>
    <IntroduceModal />
    <CommandPalette />
  </div>
</template>