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
  <div v-if="workspace" class="space-y-5">
    <UiUnderlineTabs v-model="tab" :items="tabs" :label="`Настройки ${workspace.name}`" indicator-id="settings-ws-tab" />
    <SettingsPageHeader :meta="WORKSPACE_SECTION_META[active]" :tone="active === 'delete' ? 'danger' : 'default'" />
    <slot />
  </div>
</template>
