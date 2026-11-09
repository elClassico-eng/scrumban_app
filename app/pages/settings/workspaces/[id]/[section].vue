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
    <SettingsTeamPanel v-if="section === 'general'" />
    <SettingsIntegrationsPanel v-else-if="section === 'integrations'" />
  </div>
</template>
