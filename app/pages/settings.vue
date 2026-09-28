<script setup lang="ts">
import type { SettingsTab } from '~/routing'

const TABS: SettingsTab[] = ['profile', 'security', 'notifications', 'appearance', 'danger', 'team']

const route = useRoute()
const router = useRouter()
const { current: currentWorkspace } = useCurrentWorkspace()

const tab = computed<SettingsTab>(() => {
  const q = route.query.tab as SettingsTab | undefined
  return q && TABS.includes(q) ? q : 'profile'
})

function setTab(next: SettingsTab) {
  router.replace({ query: next === 'profile' ? {} : { tab: next } })
}

useHead({ title: 'Настройки — Такт' })
</script>

<template>
  <div class="space-y-4 py-2">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-default sm:text-[28px]">Настройки</h1>
      <p class="text-sm text-muted">Управление аккаунтом и командой</p>
    </div>

    <div class="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3 lg:sticky lg:top-6">
        <SettingsNav
          :model-value="tab"
          :team-label="currentWorkspace?.name ?? null"
          @update:model-value="setTab"
        />
      </div>

      <div class="lg:col-span-9">
        <SettingsProfilePanel v-if="tab === 'profile'" />
        <SettingsSecurityPanel v-else-if="tab === 'security'" />
        <SettingsNotificationsPanel v-else-if="tab === 'notifications'" />
        <SettingsAppearancePanel v-else-if="tab === 'appearance'" />
        <SettingsDangerPanel v-else-if="tab === 'danger'" />
        <SettingsTeamPanel v-else-if="tab === 'team'" />
      </div>
    </div>
  </div>
</template>
