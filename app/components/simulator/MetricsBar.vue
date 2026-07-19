<script setup lang="ts">
import type { SprintNetworkReport } from '#shared/types/network'
import type { ScenarioSimulationReport } from '#shared/types/scenario'

const props = defineProps<{
  baseline: Extract<SprintNetworkReport, { ok: true }>
  report: ScenarioSimulationReport | null
  pending: boolean
}>()

const okReport = computed(() => (props.report?.ok ? props.report : null))

type Metric = {
  key: string
  label: string
  hint: string
  base: string
  scenario: string | null
  delta: number | null
  deltaText: string | null
  improved: boolean
}

function pct(p: number | null | undefined): string {
  return p === null || p === undefined ? '—' : `${Math.round(p * 100)}%`
}

function days(d: number | null | undefined): string {
  return d === null || d === undefined ? '—' : `${d} дн`
}

const metrics = computed<Metric[]>(() => {
  const r = okReport.value
  const base = r?.baseline ?? {
    pert: props.baseline.pert,
    simulation: props.baseline.simulation,
    criticalPathIds: props.baseline.criticalPathIds,
  }
  const sc = r?.scenario ?? null
  const delta = r?.delta ?? null

  return [
    {
      key: 'probability',
      label: 'Вероятность успеть',
      hint: 'симуляция по сети, к дедлайну',
      base: pct(base.simulation.probabilityWithinHorizon),
      scenario: sc ? pct(sc.simulation.probabilityWithinHorizon) : null,
      delta: delta?.probabilityWithinHorizon ?? null,
      deltaText: delta?.probabilityWithinHorizon === null || delta === null
        ? null
        : `${delta.probabilityWithinHorizon > 0 ? '+' : ''}${Math.round(delta.probabilityWithinHorizon * 100)} п.п.`,
      improved: (delta?.probabilityWithinHorizon ?? 0) > 0,
    },
    {
      key: 'p50',
      label: 'P50',
      hint: 'медианный срок',
      base: days(base.simulation.p50Days),
      scenario: sc ? days(sc.simulation.p50Days) : null,
      delta: delta?.p50Days ?? null,
      deltaText: delta ? `${delta.p50Days > 0 ? '−' : '+'}${Math.abs(delta.p50Days)} дн` : null,
      improved: (delta?.p50Days ?? 0) > 0,
    },
    {
      key: 'p85',
      label: 'P85',
      hint: 'с запасом на риск',
      base: days(base.simulation.p85Days),
      scenario: sc ? days(sc.simulation.p85Days) : null,
      delta: delta?.p85Days ?? null,
      deltaText: delta ? `${delta.p85Days > 0 ? '−' : '+'}${Math.abs(delta.p85Days)} дн` : null,
      improved: (delta?.p85Days ?? 0) > 0,
    },
    {
      key: 'pert',
      label: 'PERT ожидаемо',
      hint: 'аналитически, по критическому пути',
      base: days(base.pert.expectedDurationDays),
      scenario: sc ? days(sc.pert.expectedDurationDays) : null,
      delta: delta?.expectedDurationDays ?? null,
      deltaText: delta ? `${delta.expectedDurationDays > 0 ? '−' : '+'}${Math.abs(delta.expectedDurationDays)} дн` : null,
      improved: (delta?.expectedDurationDays ?? 0) > 0,
    },
  ]
})
</script>

<template>
  <div class="bg-default border border-default rounded-2xl px-6 py-5 space-y-3">
    <div class="flex items-center gap-2">
      <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-scale" class="size-3.5" />
        Базовый прогноз vs сценарий
      </h4>
      <span
        v-if="pending"
        class="text-[10.5px] text-muted inline-flex items-center gap-1"
      >
        <UIcon name="i-lucide-loader-2" class="size-3 animate-spin" />
        пересчёт…
      </span>
      <div class="flex-1" />
      <span v-if="!okReport" class="text-[11px] text-dimmed">
        добавьте изменение слева, чтобы увидеть эффект
      </span>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div
        v-for="m in metrics"
        :key="m.key"
        class="bg-muted rounded-lg px-3 py-2.5"
      >
        <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">{{ m.label }}</div>
        <div class="flex items-baseline gap-2 mt-0.5">
          <span
            class="text-[22px] font-semibold tracking-tight"
            :class="m.scenario !== null ? 'text-dimmed line-through decoration-1 text-[15px]' : 'text-default'"
          >{{ m.base }}</span>
          <span v-if="m.scenario !== null" class="text-[22px] font-semibold tracking-tight text-default">
            {{ m.scenario }}
          </span>
          <span
            v-if="m.deltaText"
            class="text-[11px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
            :class="m.improved
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : (m.delta === 0 ? 'bg-elevated text-muted' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300')"
          >{{ m.deltaText }}</span>
        </div>
        <div class="text-[11px] text-muted mt-0.5">{{ m.hint }}</div>
      </div>
    </div>
  </div>
</template>
