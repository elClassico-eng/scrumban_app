<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { apiRoutes } from '~/routing'
import { pct, RELIABILITY_TEXT } from '~/utils/forecast-labels'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { journal, accuracy } = useForecastJournalApi(wsId, bId)

const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
const board = computed(() => boardsList.data.value?.boards.find(b => b.id === bId.value))
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Журнал прогнозов` : 'Журнал прогнозов — Такт',
})

const entries = computed(() => journal.data.value?.sprints ?? [])
const report = computed(() => accuracy.data.value?.report ?? null)
const legacyCount = computed(() => report.value?.rows.filter(r => r.outcome === 'unknown').length ?? 0)

function download(url: string) {
  if (import.meta.client) window.open(url, '_blank')
}

const exportItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Журнал снапшотов · CSV', icon: 'i-lucide-file-spreadsheet', onSelect: () => download(apiRoutes.forecastJournalExport(wsId.value, bId.value, 'csv')) },
    { label: 'Журнал снапшотов · JSON', icon: 'i-lucide-braces', onSelect: () => download(apiRoutes.forecastJournalExport(wsId.value, bId.value, 'json')) },
  ],
  [
    { label: 'Калибровка · CSV', icon: 'i-lucide-file-spreadsheet', onSelect: () => download(apiRoutes.forecastCalibrationExport(wsId.value, bId.value, 'csv')) },
    { label: 'Калибровка · JSON', icon: 'i-lucide-braces', onSelect: () => download(apiRoutes.forecastCalibrationExport(wsId.value, bId.value, 'json')) },
  ],
])
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex-1 min-h-0 overflow-y-auto pt-4 pb-8 space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-semibold tracking-tight text-default sm:text-[28px]">Журнал прогнозов</h1>
          <p class="text-sm text-muted inline-flex items-center gap-1.5">
            Прогнозы фиксируются в момент, когда сделаны, и сверяются с фактом
            <AnalyticsInfo
              answers="Снапшот – слепок прогноза спринта: P50/P85/P95 по сети задач, шанс закрыть всё в срок, сколько осталось задач и SP. Три точки: старт спринта, ежедневно в 03:00 UTC, закрытие."
              note="Снапшоты неизменяемы: прогноз честен, только если записан до того, как стал известен ответ. Калибровка сравнивает снапшот старта с днём закрытия последней задачи состава; перенос хотя бы одной задачи – промах."
              action="Выгрузи журнал и калибровку через «Экспорт»: там же PERT-параметры, размер выборки и рёбра сети."
            />
          </p>
        </div>
        <UDropdownMenu :items="exportItems" :content="{ align: 'end' }">
          <UButton icon="i-lucide-download" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down">
            Экспорт
          </UButton>
        </UDropdownMenu>
      </div>

      <section v-if="report" class="surface-soft rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div class="min-w-0 flex-1">
          <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Калибровка</p>
          <p v-if="report.reliability === 'insufficient'" class="m-0 mt-0.5 text-[14px] text-default">
            Засчитано {{ report.scored }} из {{ report.rows.length }} · нужно не меньше 5
            <span v-if="legacyCount > 0" class="text-muted"> · {{ legacyCount }} закрыты до обновления, состав не записан</span>
          </p>
          <p v-else class="m-0 mt-0.5 text-[14px] text-default">
            {{ report.scored }} засчитанных спринтов · <span class="text-muted">{{ RELIABILITY_TEXT[report.reliability] }}</span>
          </p>
        </div>
        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="m-0 text-[11px] text-muted">P85 · ожидалось ~85%</p>
            <p class="m-0 text-[22px] font-semibold tabular-nums leading-tight" :class="report.reliability === 'insufficient' ? 'text-dimmed' : 'text-default'">
              {{ report.reliability === 'insufficient' ? '—' : pct(report.p85HitRate) }}
            </p>
          </div>
          <div class="text-right">
            <p class="m-0 text-[11px] text-muted">P50 · ожидалось ~50%</p>
            <p class="m-0 text-[22px] font-semibold tabular-nums leading-tight" :class="report.reliability === 'insufficient' ? 'text-dimmed' : 'text-default'">
              {{ report.reliability === 'insufficient' ? '—' : pct(report.p50HitRate) }}
            </p>
          </div>
        </div>
      </section>

      <div v-if="journal.isLoading.value" class="h-32 flex items-center justify-center text-muted">
        <UIcon name="i-lucide-loader" class="animate-spin size-6" />
      </div>

      <div v-else-if="entries.length === 0" class="py-16 text-center space-y-2">
        <UIcon name="i-lucide-history" class="size-10 text-muted mx-auto" />
        <p class="text-sm font-medium">Снапшотов пока нет</p>
        <p class="text-xs text-muted">Они появятся, когда стартует первый спринт на доске с историей закрытых задач</p>
      </div>

      <div v-else class="space-y-3">
        <ForecastJournalSprint
          v-for="e in entries"
          :key="e.sprint.id"
          :entry="e"
          :workspace-id="wsId"
          :board-id="bId"
          :default-open="e.sprint.state === 'active'"
        />
      </div>
    </div>
  </div>
</template>
