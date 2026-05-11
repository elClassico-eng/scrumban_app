<script setup lang="ts">
const colorMode = useColorMode()

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <header class="h-14 border-b border-default flex items-center justify-between px-6 bg-elevated">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-layout-dashboard" class="text-primary size-5" />
      <span class="font-semibold tracking-tight">Scrumban</span>
    </div>
    <div class="flex items-center gap-2">
      <UButton
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="toggleTheme"
      />
      <UButton icon="i-lucide-user" color="neutral" variant="ghost" size="sm" />
    </div>
  </header>
</template>