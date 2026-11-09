<script setup lang="ts">
import { pageRoutes, type WorkspaceSection } from '~/routing'

const route = useRoute()
const router = useRouter()
const { current, isLoading } = useSettingsWorkspace()
const section = computed(() => route.params.section as WorkspaceSection)

watchEffect(() => {
  if (isLoading.value) return
  if (!current.value) return void router.replace(pageRoutes.settings())
  if (!visibleWorkspaceSections(current.value.role).includes(section.value)) {
    void router.replace(pageRoutes.workspaceSettings(current.value.id))
  }
})
</script>

<template>
  <div v-if="current">
    <SettingsWorkspaceGeneralPanel v-if="section === 'general'" />
    <SettingsWorkspaceStoragePanel v-else-if="section === 'storage'" />
    <SettingsWorkspaceIntegrationsCatalog v-else-if="section === 'integrations'" />
    <SettingsWorkspaceBoardsPanel v-else-if="section === 'boards'" />
    <SettingsWorkspaceDeletePanel v-else-if="section === 'delete'" />
  </div>
</template>
