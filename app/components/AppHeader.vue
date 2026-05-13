<script setup lang="ts">
const colorMode = useColorMode()
const authStore = useAuthStore()
const { logout } = useAuthApi()

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function onLogout() {
  logout.mutate()
}
</script>

<template>
  <header class="glass h-14 flex items-center justify-between px-6 border-l-0 border-r-0 border-t-0">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-layout-dashboard" class="text-primary size-5" />
      <span class="font-semibold tracking-tight">Scrumban</span>
    </div>
    <div class="flex items-center gap-3">
      <WorkspaceTeamAvatars />
      <UButton
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="toggleTheme"
      />
      <UButton
        v-if="authStore.isAuthenticated"
        icon="i-lucide-log-out"
        :loading="logout.isPending.value"
        color="neutral"
        variant="ghost"
        size="sm"
        title="Выйти"
        @click="onLogout"
      />
    </div>
  </header>
</template>
