<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const { accuracy } = useForecastJournalApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const report = computed(() => accuracy.data.value?.report ?? null)

function pctLabel(hit: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((hit / total) * 100)}%`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Точность прогнозов</h2>
          <AnalyticsInfo
            answers="Калибровка: сверяем P50/P85-прогнозы, снятые на старте каждого спринта, с фактической длительностью после закрытия."
            formula="Честная модель: в свой P85 укладывается ~85% спринтов, в P50 — ~50%. Сильные отклонения = систематическая ошибка оценок."
            action="Если доля попаданий в P85 заметно ниже 85% — оценки оптимистичны; выше 95% — перестраховка, можно обещать смелее."
          />
          <AnalyticsPercentileHint />
        </div>
        <span class="text-xs text-muted">Сверка обещаний с реальностью</span>
      </div>
    </template>

    <div v-if="accuracy.isLoading.value" class="h-32 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="!report || report.total === 0" class="space-y-2 py-6 text-center">
      <UIcon name="i-lucide-target" class="size-10 text-muted mx-auto" />
      <p class="text-sm font-medium">Пока нечего сверять</p>
      <p class="text-xs text-muted">
        Данные появятся после закрытия спринтов, стартовавших с прогнозом.
        Стартуйте спринт — прогноз зафиксируется автоматически.
      </p>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 mb-4 text-center">
        <div class="bg-muted rounded-lg px-3 py-2.5">
          <p class="text-xs text-muted">Попадание в P85</p>
          <p class="font-mono font-semibold text-lg">
            {{ report.p85HitCount }}/{{ report.total }}
            <span class="text-[13px] text-muted">({{ pctLabel(report.p85HitCount, report.total) }}, ожидаемо ~85%)</span>
          </p>
        </div>
        <div class="bg-muted rounded-lg px-3 py-2.5">
          <p class="text-xs text-muted">Попадание в P50</p>
          <p class="font-mono font-semibold text-lg">
            {{ report.p50HitCount }}/{{ report.total }}
            <span class="text-[13px] text-muted">({{ pctLabel(report.p50HitCount, report.total) }}, ожидаемо ~50%)</span>
          </p>
        </div>
      </div>

      <p v-if="report.total < 5" class="text-[11.5px] text-muted mb-3">
        Пока {{ report.total }} {{ plural(report.total, ['закрытый спринт', 'закрытых спринта', 'закрытых спринтов']) }} —
        мало для статистических выводов, калибровка станет осмысленной от 5.
      </p>

      <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
        <div class="grid grid-cols-[minmax(0,1fr)_70px_70px_70px_90px] gap-2 px-3 py-2 bg-muted text-[10.5px] font-bold uppercase tracking-[0.06em] text-dimmed">
          <span>Спринт</span>
          <span class="text-right">P85</span>
          <span class="text-right">Факт</span>
          <span class="text-right">Ошибка</span>
          <span class="text-right">Вердикт</span>
        </div>
        <div
          v-for="r in report.rows"
          :key="r.sprintId"
          class="grid grid-cols-[minmax(0,1fr)_70px_70px_70px_90px] gap-2 px-3 py-2 text-[12.5px] items-center"
        >
          <span class="truncate text-default">{{ r.sprintName }} <span class="text-dimmed text-[11px]">· {{ fmtDate(r.endedAt) }}</span></span>
          <span class="text-right tabular-nums text-muted">{{ r.p85Days }} дн</span>
          <span class="text-right tabular-nums text-default font-medium">{{ r.actualDays }} дн</span>
          <span class="text-right tabular-nums" :class="r.actualDays > r.p85Days ? 'text-red-600 dark:text-red-400' : 'text-muted'">
            {{ r.actualDays - r.p85Days > 0 ? '+' : '' }}{{ Math.round((r.actualDays - r.p85Days) * 10) / 10 }}
          </span>
          <span class="text-right">
            <span
              class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
              :class="r.p85Hit
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'"
            >
              {{ r.p85Hit ? 'успел' : 'не успел' }}
            </span>
          </span>
        </div>
      </div>
    </template>
  </UCard>
</template>
