<script setup lang="ts">
import { ME_SECTIONS, pageRoutes, type MeSection } from '~/routing'

definePageMeta({
  middleware: (to) => {
    if (!(ME_SECTIONS as readonly string[]).includes(to.params.section as string)) {
      return navigateTo(pageRoutes.settings(), { replace: true })
    }
  },
})

const route = useRoute()
const section = computed(() => route.params.section as MeSection)
</script>

<template>
  <SettingsProfilePanel v-if="section === 'profile'" />
  <SettingsSecurityPanel v-else-if="section === 'security'" />
  <SettingsNotificationsPanel v-else-if="section === 'notifications'" />
  <SettingsAppearancePanel v-else-if="section === 'appearance'" />
  <SettingsWorkPanel v-else-if="section === 'work'" />
  <SettingsAccountPanel v-else-if="section === 'account'" />
</template>
