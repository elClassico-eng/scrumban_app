<script setup lang="ts">
import { pageRoutes, type MeSection, type WorkspaceSection } from '~/routing'

const ME_ITEMS: { key: MeSection, label: string, icon: string }[] = [
  { key: 'profile', label: 'Профиль', icon: 'i-hugeicons-user' },
  { key: 'security', label: 'Безопасность', icon: 'i-hugeicons-lock' },
  { key: 'notifications', label: 'Уведомления', icon: 'i-hugeicons-notification-02' },
  { key: 'appearance', label: 'Внешний вид', icon: 'i-hugeicons-paint-board' },
  { key: 'work', label: 'Работа', icon: 'i-hugeicons-keyboard' },
  { key: 'account', label: 'Аккаунт', icon: 'i-hugeicons-user-circle' },
]

const WORKSPACE_LABEL: Record<WorkspaceSection, string> = {
  general: 'Общее',
  storage: 'Хранилище',
  integrations: 'Интеграции',
  boards: 'Новые доски',
  delete: 'Удаление',
}

const route = useRoute()
const router = useRouter()
const { list } = useWorkspacesApi()
const workspaces = computed(() => list.data.value?.workspaces ?? [])
const openId = computed(() => route.params.id as string | undefined)

const mobileItems = computed(() => [
  ME_ITEMS.map(i => ({ label: i.label, value: pageRoutes.settings(i.key) })),
  ...workspaces.value.map(ws => visibleWorkspaceSections(ws.role).map(s => ({
    label: `${ws.name} · ${WORKSPACE_LABEL[s]}`,
    value: pageRoutes.workspaceSettings(ws.id, s),
  }))),
])
const mobileValue = computed({
  get: () => route.path.startsWith(`/settings/workspaces/${openId.value}/integrations`)
    ? pageRoutes.workspaceSettings(openId.value!, 'integrations')
    : route.path,
  set: (path: string) => void router.push(path),
})

function itemClass(active: boolean) {
  return active ? 'bg-elevated text-default' : 'text-muted hover:bg-elevated/60 hover:text-default'
}
</script>

<template>
  <USelect v-model="mobileValue" :items="mobileItems" class="w-full lg:hidden" />

  <nav class="hidden space-y-6 lg:block">
    <div class="space-y-1">
      <p class="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Я</p>
      <NuxtLink
        v-for="item in ME_ITEMS"
        :key="item.key"
        :to="pageRoutes.settings(item.key)"
        class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
        :class="itemClass(route.path === pageRoutes.settings(item.key))"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </div>

    <div v-if="workspaces.length" class="space-y-1">
      <p class="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Воркспейсы</p>
      <template v-for="ws in workspaces" :key="ws.id">
        <NuxtLink
          :to="pageRoutes.workspaceSettings(ws.id)"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
          :class="itemClass(false)"
          :aria-expanded="openId === ws.id"
        >
          <WorkspaceAvatar :name="ws.name" :logo-url="ws.logoUrl" size="xs" />
          <span class="truncate" :class="openId === ws.id && 'text-default'">{{ ws.name }}</span>
        </NuxtLink>
        <div v-if="openId === ws.id" class="space-y-0.5 pb-1">
          <NuxtLink
            v-for="s in visibleWorkspaceSections(ws.role)"
            :key="s"
            :to="pageRoutes.workspaceSettings(ws.id, s)"
            class="block rounded-lg py-1.5 pl-11 pr-3 text-sm transition-colors"
            :class="[itemClass(route.path.startsWith(pageRoutes.workspaceSettings(ws.id, s))), s === 'delete' && 'text-error-500']"
          >
            {{ WORKSPACE_LABEL[s] }}
          </NuxtLink>
        </div>
      </template>
    </div>
  </nav>
</template>
