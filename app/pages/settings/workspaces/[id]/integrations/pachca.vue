<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import type { WorkspaceFeedView } from '#shared/types/integrations'
import { apiRoutes, pageRoutes } from '~/routing'

type Tab = 'overview' | 'feeds' | 'people' | 'advanced'

const { current: workspace } = useSettingsWorkspace()
const wsId = computed(() => workspace.value?.id ?? null)
const { state } = usePachcaApi(wsId)

const data = computed(() => state.data.value)
const integration = computed(() => data.value?.integration ?? null)
const canManage = computed(() => !!data.value?.canManage)

const feeds = useQuery({
  queryKey: computed(() => ['pachca', wsId.value, 'feeds']),
  enabled: computed(() => canManage.value && !!integration.value),
  queryFn: () => $fetch<{ feeds: WorkspaceFeedView[] }>(`${apiRoutes.pachca(wsId.value!)}/feeds`),
})

const tabs = computed(() => canManage.value
  ? [
      { value: 'overview', label: 'Обзор', icon: 'i-hugeicons-dashboard-square-01' },
      { value: 'feeds', label: 'Ленты досок', icon: 'i-hugeicons-message-multiple-01' },
      { value: 'people', label: 'Люди', icon: 'i-hugeicons-user-group' },
      { value: 'advanced', label: 'Дополнительно', icon: 'i-hugeicons-settings-02' },
    ]
  : [{ value: 'people', label: 'Люди', icon: 'i-hugeicons-user-group' }])

const selected = ref<Tab>('overview')
const tab = computed<Tab>({
  get: () => (canManage.value ? selected.value : 'people'),
  set: (v) => { selected.value = v },
})
</script>

<template>
  <div v-if="workspace" class="space-y-4">
    <NuxtLink :to="pageRoutes.workspaceSettings(workspace.id, 'integrations')" class="inline-flex items-center gap-1 px-1 text-sm text-muted hover:text-default">
      <UIcon name="i-hugeicons-arrow-left-01" class="size-4" /> Интеграции
    </NuxtLink>

    <div class="flex items-center gap-4 rounded-2xl border border-default bg-gradient-to-r from-violet-500/10 via-transparent to-accent-500/10 p-5">
      <SettingsPachcaLogo size="lg" />
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold text-default">Пачка</h2>
        <p v-if="integration?.status === 'active'" class="text-sm text-success">● Подключено · бот «{{ integration.botName }}»</p>
        <p v-else-if="integration" class="text-sm text-error">● Ошибка: {{ integration.lastError }}</p>
        <p v-else class="text-sm text-muted">Не подключено</p>
      </div>
    </div>

    <p v-if="data && !data.available" class="rounded-xl bg-warning/10 p-3 text-sm text-warning">
      На сервере не задан ключ шифрования интеграций (INTEGRATIONS_SECRET). Подключение пока недоступно.
    </p>

    <template v-else-if="data && !integration">
      <SettingsPachcaConnectWizard v-if="canManage" :workspace-id="workspace.id" />
      <SettingsTile v-else>
        <p class="text-sm text-muted">Пачку подключает администратор воркспейса.</p>
      </SettingsTile>
    </template>

    <template v-else-if="data && integration">
      <UTabs v-model="tab" :items="tabs" color="neutral" variant="link" :content="false" />
      <SettingsPachcaOverviewTab v-if="tab === 'overview'" :state="data" :feeds="feeds.data.value?.feeds ?? []" @go="tab = $event" />
      <SettingsPachcaFeedsTab v-else-if="tab === 'feeds'" :workspace-id="workspace.id" :bot-name="integration.botName" />
      <SettingsPachcaPeopleTab v-else-if="tab === 'people'" :workspace-id="workspace.id" :state="data" />
      <SettingsPachcaAdvancedTab v-else-if="tab === 'advanced'" :workspace-id="workspace.id" :integration="integration" />
    </template>
  </div>
</template>
