<script setup lang="ts">
import { OUTCOME_CLASS, OUTCOME_LABEL, pct, RELIABILITY_TEXT } from '~/utils/forecast-labels'

const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const { accuracy } = useForecastJournalApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const report = computed(() => accuracy.data.value?.report ?? null)

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <UCard :ui="ANALYTICS_CARD_UI">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Точность прогнозов</h2>
          <AnalyticsInfo
            answers="Калибровка: P50/P85, снятые на старте каждого спринта, сверяются с днём закрытия последней задачи состава. Если хоть одна задача перенесена, это промах."
            formula="Честная модель: в свой P85 укладывается ~85% спринтов, в P50 ~50%. Сильные отклонения = систематическая ошибка оценок."
            action="Если доля попаданий в P85 заметно ниже 85%, оценки оптимистичны; выше 95%, перестраховка, можно обещать смелее."
          />
          <AnalyticsPercentileHint />
        </div>
        <span class="text-xs text-muted">Сверка обещаний с реальностью</span>
      </div>
    </template>

    <div v-if="accuracy.isLoading.value" class="h-32 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="!report || report.rows.length === 0" class="space-y-2 py-6 text-center">
      <UIcon name="i-lucide-target" class="size-10 text-muted mx-auto" />
      <p class="text-sm font-medium">Пока нечего сверять</p>
      <p class="text-xs text-muted">
        Данные появятся после закрытия спринтов, стартовавших с прогнозом.
        Стартуй спринт, прогноз зафиксируется автоматически.
      </p>
    </div>

    <template v-else>
      <div v-if="report.reliability === 'insufficient'" class="bg-muted rounded-lg px-3 py-2.5 mb-4 text-[12.5px] text-muted">
        Нужно не меньше 5 засчитанных спринтов, чтобы говорить о калибровке. Сейчас засчитано {{ report.scored }}<template v-if="report.unknown > 0">, ещё {{ report.unknown }} без данных об исходе</template>.
      </div>
      <div v-else class="grid grid-cols-2 gap-3 mb-4 text-center">
        <div class="bg-muted rounded-lg px-3 py-2.5">
          <p class="text-xs text-muted">P85: ожидалось ~85%</p>
          <p class="font-mono font-semibold text-lg">{{ pct(report.p85HitRate) }}</p>
          <p class="text-[11px] text-muted">на {{ report.scored }} спринтах</p>
        </div>
        <div class="bg-muted rounded-lg px-3 py-2.5">
          <p class="text-xs text-muted">P50: ожидалось ~50%</p>
          <p class="font-mono font-semibold text-lg">{{ pct(report.p50HitRate) }}</p>
          <p class="text-[11px] text-muted">{{ RELIABILITY_TEXT[report.reliability] }}</p>
        </div>
      </div>

      <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
        <div class="grid grid-cols-[minmax(0,1fr)_56px_64px_72px_84px] gap-2 px-3 py-2 bg-muted text-[10.5px] font-bold uppercase tracking-[0.06em] text-dimmed">
          <span>Спринт</span>
          <span class="text-right">P85</span>
          <span class="text-right">Факт</span>
          <span class="text-right">Закрыто</span>
          <span class="text-right">Исход</span>
        </div>
        <div
          v-for="r in report.rows"
          :key="r.sprintId"
          class="grid grid-cols-[minmax(0,1fr)_56px_64px_72px_84px] gap-2 px-3 py-2 text-[12.5px] items-center"
        >
          <span class="truncate text-default">{{ r.sprintName }} <span class="text-dimmed text-[11px]">· {{ fmtDate(r.endedAt) }}</span></span>
          <span class="text-right tabular-nums text-muted">{{ r.outcome === 'unknown' ? '—' : `${r.p85Days} дн` }}</span>
          <span class="text-right tabular-nums text-default font-medium">{{ r.actualDays === null ? '—' : `${r.actualDays} дн` }}</span>
          <span class="text-right tabular-nums text-muted">{{ r.totalCount ? `${r.doneCount}/${r.totalCount}` : '—' }}</span>
          <span class="text-right">
            <span class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" :class="OUTCOME_CLASS[r.outcome]">
              {{ OUTCOME_LABEL[r.outcome] }}
            </span>
          </span>
        </div>
      </div>
    </template>
  </UCard>
</template>
