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

const themeItems = computed(() => [
  { label: 'Светлая', icon: 'i-hugeicons-sun-03', onSelect: () => { colorMode.preference = 'light' } },
  { label: 'Тёмная', icon: 'i-hugeicons-moon', onSelect: () => { colorMode.preference = 'dark' } },
  { label: 'Система', icon: 'i-hugeicons-monitor', onSelect: () => { colorMode.preference = 'system' } },
])

const themeIcon = computed(() => {
  if (colorMode.preference === 'light') return 'i-hugeicons-sun-03'
  if (colorMode.preference === 'dark') return 'i-hugeicons-moon'
  return 'i-hugeicons-monitor'
})

function onLogout() {
  logout.mutate()
}
</script>

<template>
  <header class="bg-default m-3 rounded-2xl h-14 flex items-center justify-between px-6 border border-default shadow-sm dark:shadow-[0_4px_22px_-6px_rgba(232,80,2,0.3)]">
    <div class="flex items-baseline gap-2 text-sm">
      <span class="font-semibold tracking-tight tabular-nums text-default">{{ currentTime }}</span>
      <span class="text-muted">·</span>
      <span class="text-muted">{{ weekday }}</span>
    </div>
    <div class="flex items-center gap-3">
      <WorkspaceTeamAvatars />
      <NotificationBell v-if="authStore.isAuthenticated" />
      <UDropdownMenu :items="themeItems" :ui="{ content: 'w-40' }">
        <UButton :icon="themeIcon" color="neutral" variant="ghost" size="sm" />
      </UDropdownMenu>
      <UButton
        v-if="authStore.isAuthenticated"
        icon="i-hugeicons-log-out"
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
