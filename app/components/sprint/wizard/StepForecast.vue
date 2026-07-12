<script setup lang="ts">
import type { SprintPreviewReport } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'

const props = defineProps<{
  report: SprintPreviewReport | null
  pending: boolean
  allTasks: Task[]
}>()

const selected = defineModel<Set<string>>({ required: true })

const okReport = computed(() => (props.report?.ok ? props.report : null))

const probability = computed(() => okReport.value?.simulation.probabilityWithinHorizon ?? null)

const verdict = computed(() => {
  const p = probability.value
  if (p === null) return null
  if (p >= 0.8) return { label: 'По графику', cls: 'text-emerald-600 dark:text-emerald-400' }
  if (p >= 0.5) return { label: 'Под вопросом', cls: 'text-accent-600 dark:text-accent-400' }
  return { label: 'Высокий риск', cls: 'text-red-500' }
})

const titleById = computed(() => {
  const m = new Map<string, string>()
  for (const t of okReport.value?.tasks ?? []) m.set(t.taskId, t.title)
  for (const t of props.allTasks) if (!m.has(t.id)) m.set(t.id, t.title)
  return m
})

const criticalTitles = computed(() =>
  (okReport.value?.criticalPathIds ?? []).map(id => titleById.value.get(id) ?? '…'),
)

const unestimatedTitles = computed(() => {
  const risk = props.report?.risks.find(r => r.type === 'unestimated')
  if (!risk || risk.type !== 'unestimated') return []
  return risk.taskIds.map(id => titleById.value.get(id) ?? '…')
})

const externalRisks = computed(() =>
  (props.report?.risks ?? []).filter(r => r.type === 'external_dependency'),
)

function addBlocker(blockerTaskId: string) {
  const next = new Set(selected.value)
  next.add(blockerTaskId)
  selected.value = next
}

function pct(p: number | null): string {
  return p === null ? '—' : `${Math.round(p * 100)}`
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="pending && !report" class="py-16 text-center text-[13px] text-muted">
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin inline-block mb-2" />
      <div>Гоняем 5000 симуляций по сети зависимостей…</div>
    </div>

    <template v-else-if="report && !report.ok">
      <div class="border border-default rounded-xl px-5 py-5 flex items-start gap-3">
        <UIcon name="i-lucide-database" class="size-4 text-muted shrink-0 mt-0.5" />
        <div class="text-[13px] text-muted leading-relaxed">
          Недостаточно истории для прогноза: закрыто
          <b class="text-default">{{ report.closedSamples }}</b> задач из {{ report.requiredSamples }} необходимых.
          Спринт можно создать и без прогноза — он появится, когда команда накопит историю.
        </div>
      </div>
    </template>

    <template v-else-if="okReport">
      <div class="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
        <div class="text-center sm:text-left">
          <div
            class="text-[64px] leading-none font-semibold tracking-tight tabular-nums"
            :class="verdict?.cls ?? 'text-default'"
          >
            {{ pct(probability) }}<span class="text-[28px] font-normal">%</span>
          </div>
          <div class="text-[12px] text-muted mt-1.5">
            вероятность уложиться
            <template v-if="okReport.horizonDays !== null"> в {{ okReport.horizonDays }} дн</template>
          </div>
          <div v-if="verdict" class="text-[12px] font-semibold uppercase tracking-[0.06em] mt-1" :class="verdict.cls">
            {{ verdict.label }}
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">P50</div>
            <div class="text-[20px] font-semibold tracking-tight text-default mt-0.5">
              {{ okReport.simulation.p50Days }}<span class="text-[11px] text-muted font-normal ml-0.5">дн</span>
            </div>
          </div>
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">P85</div>
            <div class="text-[20px] font-semibold tracking-tight text-default mt-0.5">
              {{ okReport.simulation.p85Days }}<span class="text-[11px] text-muted font-normal ml-0.5">дн</span>
            </div>
          </div>
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">PERT</div>
            <div class="text-[20px] font-semibold tracking-tight text-default mt-0.5">
              {{ okReport.pert.expectedDurationDays }}<span class="text-[11px] text-muted font-normal ml-0.5">± {{ okReport.pert.sigmaDays }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="text-[11.5px] text-muted tabular-nums">
        {{ okReport.taskCount }} задач · {{ okReport.totalStoryPoints }} SP ·
        {{ okReport.edgeCount }} зависимостей · 5000 прогонов по сети
      </div>

      <div v-if="criticalTitles.length > 1" class="space-y-1.5">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Критический путь</div>
        <div class="flex flex-wrap items-center gap-1.5">
          <template v-for="(title, i) in criticalTitles" :key="i">
            <span class="text-[11.5px] font-medium px-1.5 py-0.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300">{{ title }}</span>
            <UIcon v-if="i < criticalTitles.length - 1" name="i-lucide-arrow-right" class="size-3 text-dimmed" />
          </template>
        </div>
      </div>
    </template>

    <div v-if="report && report.risks.length > 0" class="space-y-2">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Риски</div>

      <div
        v-if="unestimatedTitles.length > 0"
        class="border border-default rounded-xl px-4 py-3 flex items-start gap-2.5"
      >
        <UIcon name="i-lucide-circle-help" class="size-4 text-muted shrink-0 mt-0.5" />
        <div class="text-[12.5px] text-muted leading-relaxed">
          <b class="text-default">Без оценки:</b> {{ unestimatedTitles.join(', ') }} —
          для них взяты общие перцентили доски, прогноз менее точен.
        </div>
      </div>

      <div
        v-for="r in externalRisks"
        :key="r.type === 'external_dependency' ? `${r.taskId}-${r.blockerTaskId}` : ''"
        class="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 rounded-xl px-4 py-3 flex items-center gap-2.5"
      >
        <template v-if="r.type === 'external_dependency'">
          <UIcon name="i-lucide-triangle-alert" class="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span class="flex-1 min-w-0 text-[12.5px] text-amber-900 dark:text-amber-100">
            «{{ titleById.get(r.taskId) ?? '…' }}» ждёт «{{ r.blockerTitle }}», которой нет в составе
          </span>
          <UButton size="xs" variant="outline" color="neutral" @click="addBlocker(r.blockerTaskId)">
            Добавить
          </UButton>
        </template>
      </div>
    </div>
  </div>
</template>
