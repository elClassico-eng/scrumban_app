<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { ScenarioChange, ScenarioSimulationReport } from '#shared/types/scenario'
import { pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)
const sprintId = computed(() => route.params.sprintId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: sprintsList } = useSprintsApi(wsId, bId)
const { report: networkReport } = useSprintNetworkApi(wsId, bId, sprintId)
const { simulate } = useSprintScenariosApi(wsId, bId, sprintId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const sprint = computed(() =>
  sprintsList.data.value?.sprints.find(s => s.id === sprintId.value),
)
const canApply = computed(() => hasRole(workspace.value?.role, 'scrum_master'))

useHead({
  title: () => sprint.value ? `Симулятор — ${sprint.value.name}` : 'Симулятор — Такт',
})

const draft = ref<ScenarioChange[]>([])
const liveReport = ref<ScenarioSimulationReport | null>(null)
const loadedScenarioId = ref<string | null>(null)

const baseline = computed(() => {
  const r = networkReport.data.value
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
  loadedScenarioId.value = null
  liveReport.value = null
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start gap-3">
      <div class="min-w-0">
        <NuxtLink
          :to="pageRoutes.boardSprints(wsId, bId)"
          class="text-[12px] text-muted hover:text-default transition-colors"
        >
          ← Спринты
        </NuxtLink>
        <h1 class="text-[26px] font-semibold tracking-tight text-highlighted mt-0.5 mb-0 flex items-center gap-2.5">
          <UIcon name="i-lucide-flask-conical" class="size-6 text-accent-500" />
          Симулятор решений
          <span v-if="sprint" class="text-muted font-normal truncate">· {{ sprint.name }}</span>
        </h1>
        <p class="text-[12.5px] text-muted mt-1 mb-0 max-w-2xl leading-relaxed">
          Соберите сценарий из гипотетических изменений и посмотрите, как он сдвинет прогноз,
          до того как принять решение в реальном спринте.
        </p>
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

    <div v-if="networkReport.isLoading.value" class="text-[12.5px] text-muted py-6">
      Загружаем сеть спринта…
    </div>

    <div
      v-else-if="networkReport.data.value && !networkReport.data.value.ok"
      class="bg-default border border-default rounded-2xl px-6 py-6 flex items-start gap-2.5"
    >
      <UIcon name="i-lucide-database" class="size-4 text-muted shrink-0 mt-0.5" />
      <p class="text-[12.5px] text-muted m-0 leading-relaxed">
        Недостаточно истории для оценок: закрыто
        <b class="text-default">{{ networkReport.data.value.closedSamples }}</b> задач из
        {{ networkReport.data.value.requiredSamples }} необходимых.
        Симулятор оживёт, когда команда закроет больше задач.
      </p>
    </div>

    <template v-else-if="baseline">
      <div v-if="baseline.remainingCount === 0" class="bg-default border border-default rounded-2xl px-6 py-6 text-[12.5px] text-muted">
        Все задачи спринта закрыты — симулировать нечего.
      </div>

      <template v-else>
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

        <SimulatorScenarioShelf
          :ws-id="wsId"
          :board-id="bId"
          :sprint-id="sprintId"
          :baseline="baseline"
          :draft="draft"
          :loaded-scenario-id="loadedScenarioId"
          :can-apply="canApply"
          @load="(s) => { draft = [...s.changes]; loadedScenarioId = s.id }"
          @saved="loadedScenarioId = $event"
          @reset="resetDraft"
        />
      </template>
    </template>
  </div>
</template>
