<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ScenarioChange, ScenarioSimulationReport } from '#shared/types/scenario'
import { pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { network, simulate } = useSandboxSimulator()

useHead({ title: 'Демо симулятора — Такт' })

const draft = ref<ScenarioChange[]>([])
const liveReport = ref<ScenarioSimulationReport | null>(null)

const baseline = computed(() => {
  const r = network.data.value
  return r && r.ok ? r : null
})

watchDebounced(
  draft,
  async (changes) => {
    if (changes.length === 0) {
      liveReport.value = null
      return
    }
    try {
      liveReport.value = await simulate.mutateAsync([...changes])
    }
    catch (err) {
      const e = err as { data?: { message?: string }; message?: string }
      useToast().add({
        title: 'Не удалось пересчитать сценарий',
        description: e?.data?.message ?? e?.message ?? 'Неизвестная ошибка',
        color: 'error',
      })
    }
  },
  { debounce: 500, deep: true },
)

function resetDraft() {
  draft.value = []
  liveReport.value = null
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start gap-3">
      <div class="min-w-0">
        <NuxtLink
          :to="pageRoutes.workspaceSimulator(wsId)"
          class="text-[12px] text-muted hover:text-default transition-colors"
        >
          ← Симулятор
        </NuxtLink>
        <h1 class="text-[26px] font-semibold tracking-tight text-highlighted mt-0.5 mb-0 flex items-center gap-2.5">
          <UIcon name="i-lucide-flask-conical" class="size-6 text-accent-500" />
          Демо-пример
          <span class="text-muted font-normal truncate">· Спринт «Интеграция с 1С»</span>
        </h1>
      </div>
      <div class="flex-1" />
      <UButton
        v-if="draft.length > 0"
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-lucide-rotate-ccw"
        @click="resetDraft"
      >
        Сбросить
      </UButton>
    </div>

    <div class="bg-accent-50 dark:bg-accent-950 border border-accent-200 dark:border-accent-900 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <UIcon name="i-lucide-info" class="size-4 text-accent-600 dark:text-accent-400 shrink-0 mt-0.5" />
      <p class="text-[12.5px] text-accent-800 dark:text-accent-200 m-0 leading-relaxed">
        <b>Демо-режим.</b> Данные учебные, изменения никуда не сохраняются — экспериментируйте свободно.
        В реальном спринте вы сможете сохранять сценарии и применять их одним действием.
      </p>
    </div>

    <div v-if="network.isLoading.value" class="text-[12.5px] text-muted py-6">
      Готовим демо-спринт…
    </div>

    <template v-else-if="baseline">
      <SimulatorMetricsBar
        :baseline="baseline"
        :report="liveReport"
        :pending="simulate.isPending.value"
      />

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(300px,380px)_1fr] gap-4 items-start">
        <SimulatorChangesPanel
          v-model:draft="draft"
          :baseline="baseline"
          :horizon-days="baseline.horizonDays"
        />

        <SimulatorNetworkPreview
          :baseline="baseline"
          :report="liveReport"
        />
      </div>
    </template>
  </div>
</template>
