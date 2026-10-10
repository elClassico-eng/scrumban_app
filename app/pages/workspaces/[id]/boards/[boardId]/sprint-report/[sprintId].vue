<script setup lang="ts">
import type { SprintReportPayload } from '#shared/types/sprint-report'
import type { BurndownPoint } from '#shared/types/sprint'
import { pageRoutes } from '~/routing'

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
    <div class="flex items-start gap-3">
      <div class="min-w-0">
        <NuxtLink
          :to="pageRoutes.boardSprints(wsId, bId)"
          class="text-[12px] text-muted hover:text-default transition-colors"
        >
          ← Спринты
        </NuxtLink>
        <h1 class="text-[26px] font-semibold tracking-tight text-highlighted mt-0.5 mb-0 flex items-center gap-2.5 flex-wrap">
          <UIcon name="i-lucide-file-bar-chart-2" class="size-6 text-accent-500" />
          Отчёт спринта
          <span v-if="payload" class="text-muted font-normal truncate">· {{ payload.sprint.name }}</span>
        </h1>
        <p v-if="payload" class="text-[12.5px] text-muted mt-1 mb-0">
          {{ fmtDate(payload.sprint.startedAt) }} – {{ fmtDate(payload.sprint.endedAt) }}
          <template v-if="payload.sprint.factDurationDays"> · {{ payload.sprint.factDurationDays }} дн</template>
          <template v-if="payload.extensions.totalEndShiftDays > 0">
            · <span class="text-accent-600">продлевался на {{ payload.extensions.totalEndShiftDays }} дн</span>
          </template>
        </p>
      </div>
      <div class="flex-1" />
      <template v-if="payload && tab === 'report'">
        <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-download" @click="downloadCsv">
          CSV
        </UButton>
        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-braces" @click="copyJson">
          JSON
        </UButton>
      </template>
    </div>

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

    <div
      v-else-if="!payload"
      class="surface-soft rounded-2xl px-6 py-10 text-center space-y-3"
    >
      <UIcon name="i-lucide-file-question" class="size-8 text-dimmed" />
      <p class="text-[13px] text-muted m-0 max-w-md mx-auto">
        Отчёт по этому спринту ещё не сформирован — он был закрыт до появления отчётов.
        Отчёт можно собрать задним числом из журнала событий.
      </p>
      <UButton v-if="canGenerate" :loading="generate.isPending.value" @click="onGenerate">
        Сформировать отчёт
      </UButton>
    </div>

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

      <section class="surface-soft rounded-2xl p-5">
        <h2 class="m-0 font-semibold text-default">Обещали и получилось</h2>

        <template v-if="promise">
          <div class="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                Обещали на старте · {{ promise.takenAt }}
              </p>
              <p class="mt-2 text-sm text-default">
                <template v-if="promise.probability !== null">
                  Уложиться в срок с вероятностью
                  <b>{{ Math.round(promise.probability * 100) }}%</b>
                </template>
                <template v-else>Горизонт не задавался</template>
              </p>
              <p class="mt-1 text-sm text-muted">
                Закончить P50 <b class="text-default">{{ promise.p50 }}</b>,
                P85 <b class="text-default">{{ promise.p85 }}</b>
              </p>
              <p class="mt-1 text-xs text-muted">В работе было {{ promise.committed }} задач</p>
            </div>

            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Получилось</p>
              <p v-if="verdict" class="mt-2 text-sm text-default">
                Спринт закрыт <b>{{ verdict.closedAt }}</b>
              </p>
              <p class="mt-1 text-sm text-muted">
                Доставлено <b class="text-default">{{ payload.totals.deliveredCount }}</b>
                из {{ payload.totals.startCount }}<template v-if="deliveredShare !== null"> ({{ deliveredShare }}%)</template>
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ payload.goal.achieved === true
                  ? 'Цель достигнута'
                  : payload.goal.achieved === false ? 'Цель не достигнута' : 'Итог по цели не фиксировался' }}
              </p>
            </div>
          </div>

          <p
            v-if="verdict"
            class="mt-4 rounded-xl px-4 py-3 text-sm"
            :class="verdict.outcome === 'hit'
              ? 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400'
              : verdict.outcome === 'unknown'
                ? 'bg-muted text-muted'
                : 'bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-400'"
          >
            <template v-if="verdict.outcome === 'hit'">
              Прогноз оправдался: все задачи закрыты в пределах P85<template v-if="verdict.diffDays">, на {{ verdict.diffDays }} дн раньше</template>.
            </template>
            <template v-else-if="verdict.outcome === 'miss'">
              Прогноз не оправдался: последняя задача закрыта на {{ verdict.diffDays }} дн позже P85.
            </template>
            <template v-else-if="verdict.outcome === 'carryover'">
              Прогноз не оправдался: {{ verdict.carried }} {{ plural(verdict.carried, ['задача перенесена', 'задачи перенесены', 'задач перенесено']) }}, состав не закрыт целиком. Перенос засчитывается как промах.
            </template>
            <template v-else>
              Для этого спринта исход не определён: снапшот закрытия без состава (данные до обновления).
            </template>
          </p>
          <p v-else class="mt-4 text-sm text-muted">
            Спринт ещё не закрыт, сверять обещание пока не с чем.
          </p>
        </template>

        <p v-else class="mt-2 text-sm text-muted">
          Прогноз на старте не сохранён, поэтому сверять не с чем. Снимок делается автоматически
          при старте спринта, так что у следующих спринтов сравнение появится.
        </p>
      </section>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="surface-soft rounded-xl px-4 py-3">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Состав на старте</div>
          <div class="text-[24px] font-semibold tracking-tight text-default mt-0.5">
            {{ payload.totals.startCount }}<span class="text-[12px] text-muted font-normal ml-1">задач · {{ payload.totals.startSp }} SP</span>
          </div>
        </div>
        <div class="surface-soft rounded-xl px-4 py-3">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Доставлено</div>
          <div class="text-[24px] font-semibold tracking-tight text-default mt-0.5">
            {{ payload.totals.deliveredCount }}<span class="text-[12px] text-muted font-normal ml-1">задач · {{ payload.totals.deliveredSp }} SP</span>
          </div>
          <div v-if="deliveredShare !== null" class="text-[11px] text-muted mt-0.5">{{ deliveredShare }}% состава</div>
        </div>
        <div class="surface-soft rounded-xl px-4 py-3">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Перенесено</div>
          <div class="text-[24px] font-semibold tracking-tight text-default mt-0.5">
            {{ payload.totals.carryOverCount }}<span class="text-[12px] text-muted font-normal ml-1">задач · {{ payload.totals.carryOverSp }} SP</span>
          </div>
        </div>
        <div class="surface-soft rounded-xl px-4 py-3">
          <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Изменения состава</div>
          <div class="text-[24px] font-semibold tracking-tight text-default mt-0.5">
            +{{ payload.totals.addedAfterStartCount }}<span class="text-muted">/</span>−{{ payload.totals.removedAfterStartCount }}
          </div>
          <div class="text-[11px] text-muted mt-0.5">после старта</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div v-if="burndownPoints.length > 0" class="surface-soft rounded-2xl px-5 py-4 space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Burndown</div>
          <SprintBurndown :points="burndownPoints" :height="140" />
        </div>

        <div class="surface-soft rounded-2xl px-5 py-4 space-y-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Метрики потока</div>
          <div class="grid grid-cols-3 gap-2">
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
          <div class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="d in payload.serviceClassDistribution"
              :key="d.serviceClass"
              class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-muted"
            >
              {{ CLASS_LABEL[d.serviceClass] ?? d.serviceClass }}: <b class="text-default">{{ d.count }}</b>
            </span>
          </div>
        </div>
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
