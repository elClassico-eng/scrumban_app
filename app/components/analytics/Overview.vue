<script setup lang="ts">
import type { CycleTimeReport, ThroughputReport, WipRecommendationsReport } from '#shared/types/analytics'

const props = defineProps<{
  workspaceId: string
  boardId: string
  rangeDays: number
  throughput: ThroughputReport | undefined
  cycleTime: CycleTimeReport | undefined
  wip: WipRecommendationsReport | undefined
  loading: boolean
}>()

const { accuracy: forecastAccuracy } = useForecastJournalApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const throughputTotal = computed(() =>
  (props.throughput?.buckets ?? []).reduce((acc, b) => acc + b.count, 0),
)
const throughputPerWeek = computed(() => {
  if (!props.throughput) return null
  const weeks = Math.max(1, props.rangeDays / 7)
  return Math.round((throughputTotal.value / weeks) * 10) / 10
})

const sparkPoints = computed(() => {
  const buckets = props.throughput?.buckets ?? []
  if (buckets.length < 2) return ''
  const values = buckets.map(b => b.count)
  const max = Math.max(1, ...values)
  const w = 100
  const h = 28
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - (v / max) * (h - 3) - 1.5
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
})

const cycleP50 = computed(() => {
  const h = props.cycleTime?.stats.p50Hours
  return h == null ? null : Math.round((h / 24) * 10) / 10
})
const cycleP85 = computed(() => {
  const h = props.cycleTime?.stats.p85Hours
  return h == null ? null : Math.round((h / 24) * 10) / 10
})

const wipData = computed(() => {
  const w = props.wip
  if (!w || !w.ok) return null
  const current = w.columns.reduce((acc, c) => acc + c.currentTaskCount, 0)
  const recommended = w.columns.reduce((acc, c) => acc + c.recommendedWip, 0)
  return { current, recommended, over: current > recommended }
})

const accuracy = computed(() => {
  const r = forecastAccuracy.data.value?.report
  if (!r || r.total === 0) return null
  return { pct: Math.round((r.p85HitCount / r.total) * 100), total: r.total }
})
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="rounded-xl border border-default bg-default px-4 py-3.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">Пропускная</span>
        <UIcon name="i-lucide-gauge" class="size-3.5 text-dimmed" />
      </div>
      <div class="flex items-end justify-between gap-2 mt-1.5">
        <div>
          <div class="text-[24px] font-semibold tracking-tight text-default tabular-nums leading-none">
            {{ throughputPerWeek ?? '—' }}<span class="text-[12px] text-muted font-normal ml-1">/нед</span>
          </div>
          <div class="text-[11px] text-muted mt-1">{{ throughputTotal }} за период</div>
        </div>
        <svg v-if="sparkPoints" viewBox="0 0 100 28" class="w-20 h-7 shrink-0" preserveAspectRatio="none">
          <polyline
            :points="sparkPoints"
            fill="none"
            stroke="var(--color-accent-500)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <div class="rounded-xl border border-default bg-default px-4 py-3.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">Cycle time</span>
        <UIcon name="i-lucide-timer" class="size-3.5 text-dimmed" />
      </div>
      <div class="text-[24px] font-semibold tracking-tight text-default tabular-nums leading-none mt-1.5">
        {{ cycleP50 ?? '—' }}<span class="text-[12px] text-muted font-normal ml-1">дн P50</span>
      </div>
      <div class="text-[11px] text-muted mt-1">
        P85 <b class="text-default tabular-nums">{{ cycleP85 ?? '—' }}</b> дн
      </div>
    </div>

    <div class="rounded-xl border border-default bg-default px-4 py-3.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">WIP</span>
        <UIcon name="i-lucide-layers" class="size-3.5 text-dimmed" />
      </div>
      <div
        class="text-[24px] font-semibold tracking-tight tabular-nums leading-none mt-1.5"
        :class="wipData?.over ? 'text-red-500' : 'text-default'"
      >
        {{ wipData?.current ?? '—' }}<span class="text-[12px] text-muted font-normal ml-1">в работе</span>
      </div>
      <div class="text-[11px] text-muted mt-1">
        <template v-if="wipData">рекомендовано <b class="text-default tabular-nums">{{ wipData.recommended }}</b> (Литтл)</template>
        <template v-else>мало данных</template>
      </div>
    </div>

    <div class="rounded-xl border border-default bg-default px-4 py-3.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-medium uppercase tracking-[0.05em] text-muted">Точность</span>
        <UIcon name="i-lucide-target" class="size-3.5 text-dimmed" />
      </div>
      <div
        class="text-[24px] font-semibold tracking-tight tabular-nums leading-none mt-1.5"
        :class="accuracy && accuracy.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-default'"
      >
        {{ accuracy ? accuracy.pct : '—' }}<span class="text-[12px] text-muted font-normal ml-1">% в P85</span>
      </div>
      <div class="text-[11px] text-muted mt-1">
        <template v-if="accuracy">по {{ accuracy.total }} закрытым спринтам</template>
        <template v-else>нет закрытых спринтов</template>
      </div>
    </div>
  </div>
</template>
