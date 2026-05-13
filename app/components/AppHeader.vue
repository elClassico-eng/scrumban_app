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

const userName = computed(() => authStore.user ? displayName(authStore.user) : null)
const userInitials = computed(() => authStore.user ? initials(authStore.user) : '')
</script>

<template>
  <header class="h-14 border-b border-default flex items-center justify-between px-6 bg-elevated">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-layout-dashboard" class="text-primary size-5" />
      <span class="font-semibold tracking-tight">Scrumban</span>
    </div>
    <div class="flex items-center gap-3">
      <div v-if="authStore.user" class="flex items-center gap-2">
        <div
          class="size-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden"
          :title="userName ?? undefined"
        >
          <img
            v-if="authStore.user.avatarUrl"
            :src="authStore.user.avatarUrl"
            alt=""
            class="size-full object-cover"
          >
          <span v-else>{{ userInitials }}</span>
        </div>
        <span class="text-sm text-default hidden sm:block">
          {{ userName }}
        </span>
      </div>
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