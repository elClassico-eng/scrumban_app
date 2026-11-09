<script setup lang="ts">
import { pageRoutes, type WorkspaceSection } from '~/routing'

const props = defineProps<{ active: WorkspaceSection }>()

const router = useRouter()
const { current: workspace } = useSettingsWorkspace()

const tabs = computed(() => workspace.value
  ? visibleWorkspaceSections(workspace.value.role).map(s => ({
      value: s,
      label: WORKSPACE_SECTION_META[s].label,
      icon: WORKSPACE_SECTION_META[s].icon,
    }))
  : [])

const tab = computed({
  get: () => props.active,
  set: (s: WorkspaceSection) => {
    if (workspace.value) void router.push(pageRoutes.workspaceSettings(workspace.value.id, s))
  },
})
</script>

<template>
  <div v-if="workspace" class="space-y-4">
    <div class="flex items-center gap-3">
      <WorkspaceAvatar :name="workspace.name" :logo-url="workspace.logoUrl" size="md" />
      <div class="min-w-0">
        <h2 class="truncate text-lg font-semibold text-default">{{ workspace.name }}</h2>
        <WorkspaceMemberRoleBadge :role="workspace.role" />
      </div>
    </div>
    <UTabs v-model="tab" :items="tabs" color="neutral" variant="link" :content="false" class="overflow-x-auto" />
    <p class="text-sm text-muted">{{ WORKSPACE_SECTION_META[active].description }}</p>
    <slot />
  </div>
</template>
