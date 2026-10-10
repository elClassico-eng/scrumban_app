<script setup lang="ts">
import type { SprintReportPayload } from '#shared/types/sprint-report'
import type { BurndownPoint } from '#shared/types/sprint'
import { pageRoutes } from '~/routing'
import { OUTCOME_CLASS, OUTCOME_LABEL } from '~/utils/forecast-labels'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)
const sprintId = computed(() => route.params.sprintId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const router = useRouter()
const { list: workspacesList } = useWorkspacesApi()
const { list: sprintsList } = useSprintsApi(wsId, bId)
const { report, generate } = useSprintReportApi(wsId, bId, sprintId)

const tab = ref<'report' | 'retro'>(route.query.tab === 'retro' ? 'retro' : 'report')
watch(tab, (v) => {
  router.replace({ query: { ...route.query, tab: v === 'retro' ? 'retro' : undefined } })
})

const prevSprintId = computed(() => {
  const all = (sprintsList.data.value?.sprints ?? [])
    .filter(s => s.state === 'closed' && s.id !== sprintId.value && s.endedAt)
  const current = (sprintsList.data.value?.sprints ?? []).find(s => s.id === sprintId.value)
  const currentEnd = current?.endedAt ? new Date(current.endedAt).getTime() : Infinity
  const prev = all
    .filter(s => new Date(s.endedAt!).getTime() < currentEnd)
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())
  return prev[0]?.id ?? null
})

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const canGenerate = computed(() => hasRole(workspace.value?.role, 'scrum_master'))

const payload = computed<SprintReportPayload | null>(() =>
  report.data.value?.report.payload ?? null,
)

useHead({
  title: () => payload.value ? `Отчёт — ${payload.value.sprint.name}` : 'Отчёт спринта — Такт',
})

const toast = useToast()

async function onGenerate() {
  try {
    await generate.mutateAsync()
    toast.add({ title: 'Отчёт сформирован', icon: 'i-lucide-check', duration: 1500 })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сформировать отчёт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const CLASS_LABEL: Record<string, string> = {
  expedite: 'Срочный',
  fixed_date: 'С дедлайном',
  standard: 'Стандарт',
  intangible: 'Фоновый',
}

const burndownPoints = computed<BurndownPoint[]>(() => {
  const b = payload.value?.burndown as { points?: BurndownPoint[] } | null
  return b?.points ?? []
})

const DAY_MS = 86_400_000
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

// The promise is the snapshot taken when the sprint started; the fact is when it
// actually closed. Comparing against the close snapshot would be meaningless:
// that one is a forecast made once the answer was already known.
const promise = computed(() => {
  const snap = payload.value?.forecastVsFact.start
  if (!snap) return null
  const anchor = new Date(snap.takenAtISO).getTime()
  const sim = snap.payload.simulation
  const at = (days: number) => dayFmt.format(new Date(anchor + days * DAY_MS))
  return {
    takenAt: dayFmt.format(new Date(anchor)),
    probability: sim.probabilityWithinHorizon,
    p50: at(sim.p50Days),
    p85: at(sim.p85Days),
    p85At: anchor + sim.p85Days * DAY_MS,
    committed: snap.payload.remainingCount,
  }
})

const verdict = computed(() => {
  const p = promise.value
  const endedAt = payload.value?.sprint.endedAt
  const o = payload.value?.forecastVsFact.outcome
  if (!p || !endedAt || !o) return null
  const p85Days = payload.value!.forecastVsFact.start!.payload.simulation.p85Days
  return {
    outcome: o.outcome,
    hit: o.outcome === 'hit',
    actualDays: o.actualDays,
    diffDays: o.actualDays === null ? null : Math.round(Math.abs(o.actualDays - p85Days) * 10) / 10,
    carried: payload.value!.forecastVsFact.close?.payload.resolution?.carriedCount ?? 0,
    closedAt: dayFmt.format(new Date(endedAt)),
  }
})

const hasFlowMetrics = computed(() => {
  const f = payload.value?.flow
  return !!f && (f.throughputPerWeek !== null || f.cycleP50 !== null || f.cycleP85 !== null)
})

const deliveredShare = computed(() => {
  const t = payload.value?.totals
  if (!t || t.startCount === 0) return null
  return Math.round((t.deliveredCount / t.startCount) * 100)
})

function downloadCsv() {
  const p = payload.value
  if (!p) return
  const header = 'title;storyPoints;serviceClass;status;addedAt;closedAt;cycleDays'
  const lines = p.tasks.map(t =>
    [
      `"${t.title.replaceAll('"', '""')}"`,
      t.storyPoints ?? '',
      t.serviceClass,
      t.status,
      t.addedAtISO ?? '',
      t.closedAtISO ?? '',
      t.cycleDays ?? '',
    ].join(';'),
  )
  const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sprint-report-${p.sprint.name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function copyJson() {
  if (!payload.value) return
  await navigator.clipboard.writeText(JSON.stringify(payload.value, null, 2))
  toast.add({ title: 'JSON скопирован', icon: 'i-lucide-clipboard-check', duration: 1200 })
}
</script>

<template>
  <div class="space-y-5">
    <UiPageHeader
      :title="payload ? `Отчёт спринта · ${payload.sprint.name}` : 'Отчёт спринта'"
      icon="i-lucide-file-bar-chart-2"
      :back="{ to: pageRoutes.boardSprints(wsId, bId), label: 'Спринты' }"
    >
      <template v-if="payload" #subtitle>
        {{ fmtDate(payload.sprint.startedAt) }} – {{ fmtDate(payload.sprint.endedAt) }}
        <template v-if="payload.sprint.factDurationDays"> · {{ payload.sprint.factDurationDays }} дн</template>
        <template v-if="payload.extensions.totalEndShiftDays > 0">
          · <span class="text-accent-600">продлевался на {{ payload.extensions.totalEndShiftDays }} дн</span>
        </template>
      </template>
      <template v-if="payload && tab === 'report'" #actions>
        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-download" @click="downloadCsv">
          CSV
        </UButton>
        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-braces" @click="copyJson">
          JSON
        </UButton>
      </template>
    </UiPageHeader>

    <div class="flex items-center gap-1 border-b border-default">
      <button
        v-for="t in [{ key: 'report', label: 'Отчёт', icon: 'i-lucide-file-bar-chart-2' }, { key: 'retro', label: 'Ретроспектива', icon: 'i-lucide-messages-square' }]"
        :key="t.key"
        type="button"
        class="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer"
        :class="tab === t.key
          ? 'border-accent-500 text-highlighted'
          : 'border-transparent text-muted hover:text-default'"
        @click="tab = t.key as 'report' | 'retro'"
      >
        <UIcon :name="t.icon" class="size-4" />
        {{ t.label }}
      </button>
    </div>

    <SprintRetroBoard
      v-if="tab === 'retro'"
      :ws-id="wsId"
      :board-id="bId"
      :sprint-id="sprintId"
      :payload="payload"
      :prev-sprint-id="prevSprintId"
    />

    <div v-else-if="report.isLoading.value" class="text-[12.5px] text-muted py-6">
      Загружаем отчёт…
    </div>

    <UiEmptyState
      v-else-if="!payload"
      icon="i-lucide-file-question"
      title="Отчёт ещё не сформирован"
      text="Спринт закрыт до появления отчётов. Отчёт можно собрать задним числом из журнала событий."
    >
      <template v-if="canGenerate" #actions>
        <UButton :loading="generate.isPending.value" @click="onGenerate">
          Сформировать отчёт
        </UButton>
      </template>
    </UiEmptyState>

    <template v-else>
      <div
        class="rounded-2xl px-6 py-5 border"
        :class="payload.goal.achieved === true
          ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900'
          : payload.goal.achieved === false
            ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900'
            : 'bg-default border-default'"
      >
        <div class="flex items-center gap-2.5">
          <UIcon
            :name="payload.goal.achieved === true ? 'i-lucide-target' : payload.goal.achieved === false ? 'i-lucide-x-circle' : 'i-lucide-circle-help'"
            class="size-5"
            :class="payload.goal.achieved === true ? 'text-emerald-600' : payload.goal.achieved === false ? 'text-red-500' : 'text-muted'"
          />
          <span class="text-[15px] font-semibold">
            {{ payload.goal.achieved === true ? 'Цель достигнута' : payload.goal.achieved === false ? 'Цель не достигнута' : 'Итог по цели не фиксировался' }}
          </span>
        </div>
        <p v-if="payload.sprint.goal" class="text-[13px] text-muted mt-2 mb-0">
          Цель: {{ payload.sprint.goal }}
        </p>
        <p v-if="payload.goal.comment" class="text-[13px] text-default mt-1.5 mb-0">
          {{ payload.goal.comment }}
        </p>
      </div>

      <UiPanel title="Обещали и получилось">
        <div v-if="promise" class="grid gap-6 sm:grid-cols-3">
          <div>
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Обещание · {{ promise.takenAt }}</p>
            <p class="m-0 mt-2 text-[22px] font-semibold tabular-nums leading-none text-default">
              <template v-if="promise.probability !== null">{{ Math.round(promise.probability * 100) }}%</template>
              <template v-else>—</template>
            </p>
            <p class="m-0 mt-1 text-[12px] text-muted">
              <template v-if="promise.probability !== null">шанс уложиться в срок</template>
              <template v-else>горизонт не задавался</template>
            </p>
            <p class="m-0 mt-2 text-sm text-muted">
              P50 <b class="text-default">{{ promise.p50 }}</b> · P85 <b class="text-default">{{ promise.p85 }}</b>
            </p>
            <p class="m-0 mt-0.5 text-xs text-muted">в работе было {{ promise.committed }} задач</p>
          </div>

          <div>
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Получилось</p>
            <p class="m-0 mt-2 text-[22px] font-semibold tabular-nums leading-none text-default">
              {{ payload.totals.deliveredCount }}<span class="text-[13px] font-normal text-muted"> из {{ payload.totals.startCount }}</span>
            </p>
            <p class="m-0 mt-1 text-[12px] text-muted">
              доставлено<template v-if="deliveredShare !== null"> · {{ deliveredShare }}%</template>
            </p>
            <p class="m-0 mt-2 text-sm text-muted">
              перенесено <b class="text-default">{{ payload.totals.carryOverCount }}</b>
              <template v-if="verdict"> · закрыт <b class="text-default">{{ verdict.closedAt }}</b></template>
            </p>
            <p class="m-0 mt-0.5 text-xs text-muted">
              {{ payload.goal.achieved === true ? 'цель достигнута' : payload.goal.achieved === false ? 'цель не достигнута' : 'итог по цели не фиксировался' }}
            </p>
          </div>

          <div>
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Исход</p>
            <template v-if="verdict">
              <span
                class="mt-2 inline-flex items-center rounded-md px-2 py-1 text-[13px] font-semibold"
                :class="OUTCOME_CLASS[verdict.outcome]"
              >
                {{ OUTCOME_LABEL[verdict.outcome] }}
              </span>
              <p class="m-0 mt-2 text-sm text-muted">
                <template v-if="verdict.outcome === 'hit'">Все задачи закрыты в пределах P85<template v-if="verdict.diffDays">, на {{ verdict.diffDays }} дн раньше</template>.</template>
                <template v-else-if="verdict.outcome === 'miss'">Последняя задача закрыта на {{ verdict.diffDays }} дн позже P85.</template>
                <template v-else-if="verdict.outcome === 'carryover'">{{ verdict.carried }} {{ plural(verdict.carried, ['задача перенесена', 'задачи перенесены', 'задач перенесено']) }}; перенос засчитывается как промах.</template>
                <template v-else>Снапшот закрытия без состава (данные до обновления).</template>
              </p>
            </template>
            <p v-else class="m-0 mt-2 text-sm text-muted">Спринт ещё не закрыт, сверять обещание пока не с чем.</p>
          </div>
        </div>

        <p v-else class="m-0 text-sm text-muted">
          Прогноз на старте не сохранён, поэтому сверять не с чем. Снимок делается автоматически
          при старте спринта, так что у следующих спринтов сравнение появится.
        </p>
      </UiPanel>

      <UiPanel>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <UiStat label="Состав на старте" :value="payload.totals.startCount" :sub="`задач · ${payload.totals.startSp} SP`" />
          <UiStat label="Доставлено" :value="payload.totals.deliveredCount" :sub="`задач · ${payload.totals.deliveredSp} SP${deliveredShare !== null ? ` · ${deliveredShare}% состава` : ''}`" />
          <UiStat label="Перенесено" :value="payload.totals.carryOverCount" :sub="`задач · ${payload.totals.carryOverSp} SP`" :tone="payload.totals.carryOverCount > 0 ? 'warning' : 'default'" />
          <UiStat label="Изменения состава" :value="`+${payload.totals.addedAfterStartCount} / −${payload.totals.removedAfterStartCount}`" sub="после старта" />
        </div>
      </UiPanel>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <UiPanel title="Burndown">
          <SprintBurndown v-if="burndownPoints.length >= 2" :points="burndownPoints" :height="140" />
          <p v-else class="m-0 text-[12.5px] text-muted">Слишком мало точек, чтобы рисовать график: {{ burndownPoints.length }} из нужных 2.</p>
        </UiPanel>

        <UiPanel v-if="hasFlowMetrics || payload.serviceClassDistribution.length > 0" title="Метрики потока">
          <div v-if="hasFlowMetrics" class="grid grid-cols-3 gap-2">
            <div>
              <div class="text-[10px] font-semibold uppercase text-muted">Throughput</div>
              <div class="text-[18px] font-semibold text-default">{{ payload.flow.throughputPerWeek ?? '—' }}<span class="text-[10px] text-muted font-normal ml-0.5">задач/нед</span></div>
            </div>
            <div>
              <div class="text-[10px] font-semibold uppercase text-muted">Cycle P50</div>
              <div class="text-[18px] font-semibold text-default">{{ payload.flow.cycleP50 ?? '—' }}<span class="text-[10px] text-muted font-normal ml-0.5">дн</span></div>
            </div>
            <div>
              <div class="text-[10px] font-semibold uppercase text-muted">Cycle P85</div>
              <div class="text-[18px] font-semibold text-default">{{ payload.flow.cycleP85 ?? '—' }}<span class="text-[10px] text-muted font-normal ml-0.5">дн</span></div>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5" :class="hasFlowMetrics ? 'pt-3' : ''">
            <span
              v-for="d in payload.serviceClassDistribution"
              :key="d.serviceClass"
              class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-muted"
            >
              {{ CLASS_LABEL[d.serviceClass] ?? d.serviceClass }}: <b class="text-default">{{ d.count }}</b>
            </span>
          </div>
        </UiPanel>
      </div>

      <div v-if="payload.carryOver.length > 0" class="surface-soft rounded-2xl px-5 py-4 space-y-2">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Переносы</div>
        <div class="divide-y divide-default">
          <div
            v-for="c in payload.carryOver"
            :key="c.taskId"
            class="flex items-center gap-2.5 py-2 text-[13px]"
          >
            <span class="truncate text-default flex-1">{{ c.title }}</span>
            <span
              v-if="c.streak >= 2"
              class="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300"
            >{{ c.streak }}-й спринт подряд</span>
            <span class="shrink-0 text-[11.5px] text-muted w-40 text-right">
              {{ c.decision === 'next_sprint' ? 'в следующий спринт' : c.decision === 'backlog' ? 'в бэклог' : c.decision === 'keep' ? 'остался в спринте' : '—' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="payload.scopeChanges.length > 0" class="surface-soft rounded-2xl px-5 py-4 space-y-2">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Изменения состава после старта</div>
        <div class="divide-y divide-default">
          <div
            v-for="(c, i) in payload.scopeChanges"
            :key="i"
            class="flex items-center gap-2.5 py-2 text-[13px]"
          >
            <UIcon
              :name="c.kind === 'added' ? 'i-lucide-circle-plus' : 'i-lucide-circle-minus'"
              class="size-4 shrink-0"
              :class="c.kind === 'added' ? 'text-accent-600' : 'text-muted'"
            />
            <span class="truncate text-default flex-1">{{ c.title }}</span>
            <span class="shrink-0 text-[11.5px] text-muted tabular-nums">{{ fmtDate(c.atISO) }}</span>
          </div>
        </div>
      </div>

      <div v-if="payload.appliedScenarios.length > 0" class="surface-soft rounded-2xl px-5 py-4 space-y-2">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-flask-conical" class="size-3.5" />
          Решения через симулятор
        </div>
        <div class="divide-y divide-default">
          <div
            v-for="s in payload.appliedScenarios"
            :key="s.id"
            class="flex items-center gap-2.5 py-2 text-[13px]"
          >
            <span class="truncate text-default flex-1">{{ s.name }}</span>
            <span class="shrink-0 text-[11.5px] text-muted">{{ s.changesCount }} изм. · {{ fmtDate(s.appliedAtISO) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
