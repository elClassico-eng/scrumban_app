<script setup lang="ts">
import type { BoardForecastJournal } from '#shared/types/forecast'
import { OUTCOME_CLASS, OUTCOME_LABEL, TRIGGER_LABEL } from '~/utils/forecast-labels'

const props = defineProps<{
  entry: BoardForecastJournal['sprints'][number]
  defaultOpen?: boolean
}>()

const open = ref(props.defaultOpen ?? false)

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const period = computed(() => {
  const s = props.entry.sprint
  if (!s.startedAt) return 'не стартовал'
  const from = dateFmt.format(new Date(s.startedAt))
  return s.endedAt ? `${from} – ${dateFmt.format(new Date(s.endedAt))}` : `с ${from}`
})

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)
</script>

<template>
  <div class="surface-soft rounded-2xl overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer transition-colors hover:bg-elevated/40"
      @click="open = !open"
    >
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted transition-transform" :class="open ? 'rotate-90' : ''" />
      <span class="flex-1 min-w-0">
        <span class="block text-[14px] font-semibold text-default truncate">{{ entry.sprint.name }}</span>
        <span class="block text-[12px] text-muted">{{ period }} · снапшотов: {{ entry.snapshots.length }}</span>
      </span>
      <span
        v-if="entry.sprint.state === 'active'"
        class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-500"
      >
        активный
      </span>
      <template v-else-if="entry.outcome">
        <span class="hidden sm:inline text-[12px] text-muted tabular-nums">
          P85 {{ entry.outcome.p85Days === null ? '—' : `${entry.outcome.p85Days} дн` }} · факт {{ entry.outcome.actualDays === null ? '—' : `${entry.outcome.actualDays} дн` }} · закрыто {{ entry.outcome.totalCount === null ? '—' : `${entry.outcome.doneCount}/${entry.outcome.totalCount}` }}
        </span>
        <span class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" :class="OUTCOME_CLASS[entry.outcome.outcome]">
          {{ OUTCOME_LABEL[entry.outcome.outcome] }}
        </span>
      </template>
    </button>

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
              <th class="text-right font-bold px-3 py-2">Осталось</th>
              <th class="text-right font-bold px-3 py-2">SP</th>
              <th class="text-right font-bold px-3 py-2">Выборка</th>
              <th class="text-right font-bold px-5 py-2">Рёбра</th>
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
              <td class="px-3 py-2 text-right text-muted">{{ s.payload.remainingCount }}</td>
              <td class="px-3 py-2 text-right text-muted">{{ s.payload.committedSp }}</td>
              <td class="px-3 py-2 text-right text-muted">{{ s.payload.closedSamples }}</td>
              <td class="px-5 py-2 text-right text-muted">{{ s.payload.edgeCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
