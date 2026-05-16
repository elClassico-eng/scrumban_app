<script setup lang="ts">
const colorMode = useColorMode()
const authStore = useAuthStore()
const { logout } = useAuthApi()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 30_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const currentTime = computed(() =>
  now.value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
)

const weekday = computed(() => {
  const raw = now.value.toLocaleDateString('ru-RU', { weekday: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
})

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function onLogout() {
  logout.mutate()
}
</script>

<template>
  <header class="bg-white m-3 rounded-2xl h-14 flex items-center justify-between px-6 border-b border-neutral-100">
    <div class="flex items-baseline gap-2 text-sm">
      <span class="font-semibold tracking-tight tabular-nums text-default">{{ currentTime }}</span>
      <span class="text-muted">·</span>
      <span class="text-muted">{{ weekday }}</span>
    </div>
    <div class="flex items-center gap-3">
      <WorkspaceTeamAvatars />
      <NotificationBell v-if="authStore.isAuthenticated" />
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
