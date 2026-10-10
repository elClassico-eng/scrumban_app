<script setup lang="ts">
import type { BoardForecastJournal } from '#shared/types/forecast'
import { pageRoutes } from '~/routing'
import { OUTCOME_CLASS, OUTCOME_LABEL, TRIGGER_LABEL } from '~/utils/forecast-labels'

const props = defineProps<{
  entry: BoardForecastJournal['sprints'][number]
  workspaceId: string
  boardId: string
  defaultOpen?: boolean
}>()

const open = ref(props.defaultOpen ?? false)

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const period = computed(() => {
  const s = props.entry.sprint
  if (!s.startedAt) return ''
  const from = dateFmt.format(new Date(s.startedAt))
  return s.endedAt ? `${from} – ${dateFmt.format(new Date(s.endedAt))}` : `с ${from}`
})

const isActive = computed(() => props.entry.sprint.state === 'active')
const forecastSnaps = computed(() => props.entry.snapshots.filter(s => s.trigger !== 'sprint_close'))
const latest = computed(() =>
  isActive.value
    ? forecastSnaps.value.at(-1) ?? null
    : props.entry.snapshots.find(s => s.trigger === 'sprint_start') ?? forecastSnaps.value[0] ?? null,
)
const p85Series = computed(() => forecastSnaps.value.map(s => s.payload.simulation.p85Days))
const showSparkline = computed(() => p85Series.value.length >= 3)
const p85Max = computed(() => Math.max(1, ...p85Series.value))
const legacy = computed(() => !isActive.value && props.entry.outcome?.outcome === 'unknown')

const outcomeLabel = computed(() => {
  if (isActive.value) return 'активный'
  if (legacy.value) return 'закрыт до обновления'
  return props.entry.outcome ? OUTCOME_LABEL[props.entry.outcome.outcome] : ''
})
const outcomeClass = computed(() => {
  if (isActive.value) return 'bg-accent-500/10 text-accent-500'
  return props.entry.outcome ? OUTCOME_CLASS[props.entry.outcome.outcome] : ''
})

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)
</script>

<template>
  <div class="surface-soft rounded-2xl overflow-hidden">
    <div class="flex items-center gap-4 px-5 py-4">
      <button
        type="button"
        class="size-7 rounded-lg grid place-items-center text-muted cursor-pointer transition-colors hover:bg-elevated shrink-0"
        :title="open ? 'Свернуть снапшоты' : 'Показать снапшоты'"
        @click="open = !open"
      >
        <UIcon name="i-lucide-chevron-right" class="size-4 transition-transform" :class="open ? 'rotate-90' : ''" />
      </button>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <NuxtLink
            :to="isActive ? pageRoutes.boardSprints(workspaceId, boardId) : pageRoutes.sprintReportPage(workspaceId, boardId, entry.sprint.id)"
            class="text-[14px] font-semibold text-default truncate hover:text-accent-500 transition-colors"
          >
            {{ entry.sprint.name }}
          </NuxtLink>
          <span class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" :class="outcomeClass">{{ outcomeLabel }}</span>
        </div>
        <p class="m-0 mt-0.5 text-[12px] text-muted">
          {{ period }} · {{ entry.snapshots.length }} {{ plural(entry.snapshots.length, ['снапшот', 'снапшота', 'снапшотов']) }}
          <template v-if="entry.outcome && entry.outcome.outcome === 'carryover'"> · перенесено {{ entry.outcome.carriedCount }}</template>
          <template v-else-if="entry.outcome && entry.outcome.totalCount !== null"> · закрыто {{ entry.outcome.doneCount }}/{{ entry.outcome.totalCount }}</template>
          <template v-else-if="legacy"> · состав на закрытии не записан, в калибровке не участвует</template>
        </p>
      </div>

      <div v-if="showSparkline" class="hidden sm:flex items-end gap-[3px] h-[22px] w-[88px] shrink-0" title="P85 по снапшотам">
        <div
          v-for="(v, i) in p85Series"
          :key="i"
          class="flex-1 rounded-[2px]"
          :class="i === p85Series.length - 1 ? 'bg-accent-500' : 'bg-elevated'"
          :style="{ height: `${Math.max(12, (v / p85Max) * 100)}%` }"
        />
      </div>

      <div v-if="latest" class="text-right shrink-0 w-[120px]">
        <p class="m-0 text-[15px] font-semibold tabular-nums text-default leading-tight">P85 {{ latest.payload.simulation.p85Days }} дн</p>
        <p class="m-0 text-[11.5px] tabular-nums" :class="isActive ? 'text-muted' : 'text-muted'">
          <template v-if="!isActive && entry.outcome && entry.outcome.actualDays !== null">факт {{ entry.outcome.actualDays }} дн</template>
          <template v-else-if="latest.payload.simulation.probabilityWithinHorizon !== null">шанс в срок {{ pct(latest.payload.simulation.probabilityWithinHorizon) }}</template>
          <template v-else>—</template>
        </p>
      </div>
      <p v-else class="m-0 text-[12px] text-muted shrink-0">без снапшотов</p>
    </div>

    <div v-if="open" class="border-t border-default">
      <div v-if="entry.snapshots.length === 0" class="px-5 py-4 text-[13px] text-muted">
        Снапшотов нет: на старте не хватило истории закрытых задач для прогноза.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-[12.5px] tabular-nums">
          <thead>
            <tr class="text-[10.5px] font-bold uppercase tracking-[0.06em] text-dimmed bg-muted">
              <th class="text-left font-bold px-5 py-2">Когда</th>
              <th class="text-left font-bold px-3 py-2">Точка</th>
              <th class="text-right font-bold px-3 py-2">P50</th>
              <th class="text-right font-bold px-3 py-2">P85</th>
              <th class="text-right font-bold px-3 py-2">P95</th>
              <th class="text-right font-bold px-3 py-2">Шанс в срок</th>
              <th class="text-right font-bold px-3 py-2">Наивный</th>
              <th class="text-right font-bold px-5 py-2">Осталось</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="s in entry.snapshots" :key="s.id">
              <td class="px-5 py-2 text-default whitespace-nowrap">{{ timeFmt.format(new Date(s.takenAt)) }}</td>
              <td class="px-3 py-2">
                <span
                  class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                  :class="s.trigger === 'daily' ? 'bg-elevated text-muted' : 'bg-accent-500/10 text-accent-500'"
                >
                  {{ TRIGGER_LABEL[s.trigger] }}
                </span>
              </td>
              <td class="px-3 py-2 text-right text-muted">{{ s.payload.simulation.p50Days }}</td>
              <td class="px-3 py-2 text-right text-default font-medium">{{ s.payload.simulation.p85Days }}</td>
              <td class="px-3 py-2 text-right text-muted">{{ s.payload.simulation.p95Days }}</td>
              <td class="px-3 py-2 text-right text-default">{{ pct(s.payload.simulation.probabilityWithinHorizon) }}</td>
              <td class="px-3 py-2 text-right text-muted">{{ pct(s.payload.naiveProbability) }}</td>
              <td class="px-5 py-2 text-right text-muted">{{ s.payload.remainingCount }} задач · {{ s.payload.committedSp }} SP</td>
            </tr>
          </tbody>
        </table>
        <p class="m-0 px-5 py-2 text-[11.5px] text-dimmed border-t border-default">Размер выборки, рёбра сети и PERT-параметры есть в экспорте журнала.</p>
      </div>
    </div>
  </div>
</template>
