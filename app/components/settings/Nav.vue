<script setup lang="ts">
import { ME_SECTIONS, pageRoutes } from '~/routing'

const route = useRoute()
const router = useRouter()
const { me } = useProfileApi()
const { list } = useWorkspacesApi()
const workspaces = computed(() => list.data.value?.workspaces ?? [])
const user = computed(() => me.data.value?.user ?? null)
const openId = computed(() => route.params.id as string | undefined)

const mobileItems = computed(() => [
  ME_SECTIONS.map(s => ({ label: ME_SECTION_META[s].label, value: pageRoutes.settings(s) })),
  workspaces.value.map(ws => ({ label: ws.name, value: pageRoutes.workspaceSettings(ws.id) })),
])
const mobileValue = computed({
  get: () => (openId.value ? pageRoutes.workspaceSettings(openId.value) : route.path),
  set: (path: string) => void router.push(path),
})

function itemClass(active: boolean) {
  return active ? 'bg-elevated text-default' : 'text-muted hover:bg-elevated/60 hover:text-default'
}
</script>

<template>
  <USelect v-model="mobileValue" :items="mobileItems" class="w-full lg:hidden" />

  <nav class="hidden space-y-4 rounded-2xl border border-default bg-default/70 p-2 lg:block">
    <div class="space-y-1">
      <NuxtLink
        v-if="user"
        :to="pageRoutes.settings('profile')"
        class="mb-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-elevated/60"
      >
        <UserAvatar :user="user" size="md" />
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-default">{{ displayName(user) }}</span>
          <span class="block truncate text-xs text-muted">{{ user.email }}</span>
        </span>
      </NuxtLink>
      <NuxtLink
        v-for="s in ME_SECTIONS"
        :key="s"
        :to="pageRoutes.settings(s)"
        class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
        :class="itemClass(route.path === pageRoutes.settings(s))"
      >
        <UIcon :name="ME_SECTION_META[s].icon" class="size-4 shrink-0" />
        {{ ME_SECTION_META[s].label }}
      </NuxtLink>
    </div>

    <div v-if="workspaces.length" class="space-y-1 border-t border-default pt-3">
      <p class="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Воркспейсы</p>
      <NuxtLink
        v-for="ws in workspaces"
        :key="ws.id"
        :to="pageRoutes.workspaceSettings(ws.id)"
        class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
        :class="itemClass(openId === ws.id)"
      >
        <WorkspaceAvatar :name="ws.name" :logo-url="ws.logoUrl" size="xs" />
        <span class="truncate">{{ ws.name }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
