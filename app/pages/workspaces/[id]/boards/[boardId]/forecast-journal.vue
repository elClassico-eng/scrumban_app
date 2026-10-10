<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { apiRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { journal } = useForecastJournalApi(wsId, bId)

const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
const board = computed(() => boardsList.data.value?.boards.find(b => b.id === bId.value))
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Журнал прогнозов` : 'Журнал прогнозов — Такт',
})

const entries = computed(() => journal.data.value?.sprints ?? [])

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
          <p class="text-sm text-muted">Прогнозы фиксируются в момент, когда сделаны, и сверяются с фактом</p>
        </div>
        <UDropdownMenu :items="exportItems" :content="{ align: 'end' }">
          <UButton icon="i-lucide-download" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down">
            Экспорт
          </UButton>
        </UDropdownMenu>
      </div>

      <section class="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 max-w-5xl">
        <div>
          <p class="m-0 text-[14px] font-semibold text-default">Что такое снапшот</p>
          <p class="m-0 mt-1 text-[13px] text-muted leading-relaxed">
            Слепок прогноза спринта: P50/P85/P95 по сети задач, шанс закрыть всё в срок, сколько осталось задач и SP, на какой истории это посчитано.
          </p>
        </div>
        <div>
          <p class="m-0 text-[14px] font-semibold text-default">Три точки</p>
          <p class="m-0 mt-1 text-[13px] text-muted leading-relaxed">
            Снапшот старта пишется, когда спринт запускают. Дальше раз в сутки (03:00 UTC) снимается ежедневный, чтобы видеть, как прогноз сходится. Снапшот закрытия фиксирует состав и момент закрытия последней задачи.
          </p>
        </div>
        <div>
          <p class="m-0 text-[14px] font-semibold text-default">Почему не пересчитываем</p>
          <p class="m-0 mt-1 text-[13px] text-muted leading-relaxed">
            Прогноз честен только если записан до того, как стал известен ответ. Задним числом всегда «так и думали». Поэтому снапшоты неизменяемы, а калибровка сравнивает именно их с фактом.
          </p>
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
          :default-open="e.sprint.state === 'active'"
        />
      </div>
    </div>
  </div>
</template>
