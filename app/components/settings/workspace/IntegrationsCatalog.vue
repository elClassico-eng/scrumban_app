<script setup lang="ts">
import { pageRoutes } from '~/routing'

const { current: workspace } = useSettingsWorkspace()
const { state } = usePachcaApi(computed(() => workspace.value?.id ?? null))
const integration = computed(() => state.data.value?.integration ?? null)
</script>

<template>
  <div v-if="workspace" class="space-y-3">
    <p class="px-1 text-[11px] font-medium uppercase tracking-wide text-muted">Связь</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        :to="pageRoutes.pachcaSettings(workspace.id)"
        class="group flex flex-col gap-4 rounded-2xl p-5 surface-soft transition-shadow hover:shadow-md"
      >
        <div class="flex items-center gap-3">
          <SettingsPachcaLogo />
          <div class="min-w-0">
            <p class="font-semibold text-default">Пачка</p>
            <p class="text-xs text-muted">Корпоративный мессенджер</p>
          </div>
        </div>
        <p class="text-sm text-muted">Уведомления в личку, ленты досок в чаты команды и карточки ссылок на задачи.</p>
        <div class="mt-auto flex items-center justify-between text-sm">
          <span v-if="integration?.status === 'active'" class="flex items-center gap-1.5 text-success">
            <span class="size-1.5 rounded-full bg-success" /> Подключено
          </span>
          <span v-else-if="integration" class="flex items-center gap-1.5 text-error">
            <span class="size-1.5 rounded-full bg-error" /> Ошибка
          </span>
          <span v-else class="text-muted">Не подключено</span>
          <span class="text-default group-hover:underline">{{ integration ? 'Настроить' : 'Подключить' }} →</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
