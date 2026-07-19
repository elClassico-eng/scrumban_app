<script setup lang="ts">
import VChart from 'vue-echarts'
import type { MaybeRef } from 'vue'

const props = defineProps<{
  workspaceId: MaybeRef<string>
  boardId: MaybeRef<string>
}>()

const { tokens, textStyle, tooltip, categoryAxis, valueAxis } = useChartTheme()

const wsId = computed(() => unref(props.workspaceId))
const bId = computed(() => unref(props.boardId))

const { timeReport } = useAnalyticsApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)

const report = computed(() => timeReport.data.value)
const isLoading = computed(() => timeReport.isLoading.value)

function resolveDisplayName(userId: string): string {
  const member = membersList.data.value?.members.find(m => m.userId === userId)
  if (!member) return userId.slice(0, 8)
  const parts = [member.firstName, member.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : member.email
}

const barOption = computed(() => {
  const rows = report.value?.byUser ?? []
  if (rows.length === 0) return {}
  const sorted = [...rows].sort((a, b) => b.totalSeconds - a.totalSeconds)
  const c = tokens.value
  return {
    textStyle: textStyle.value,
    tooltip: { ...tooltip.value, trigger: 'axis', formatter: (params: Array<{ name: string; value: number }>) =>
      params[0] ? `${params[0].name}: <b>${formatDuration(params[0].value)}</b>` : ''
    },
    grid: { top: 10, left: 10, right: 56, bottom: 6, containLabel: true },
    xAxis: valueAxis({ axisLabel: { color: c.axisLabel, fontSize: 11, formatter: (v: number) => formatDuration(v) } }),
    yAxis: categoryAxis({ data: sorted.map(r => resolveDisplayName(r.userId)) }),
    series: [{
      type: 'bar',
      barMaxWidth: 22,
      data: sorted.map(r => r.totalSeconds),
      itemStyle: { color: c.accent, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color: c.accent, opacity: 0.85 } },
    }],
  }
})

const hasUserData = computed(() => (report.value?.byUser.length ?? 0) > 0)
const hasSprintData = computed(() => (report.value?.bySprint.length ?? 0) > 0)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Время</h2>
        <span class="text-xs text-muted">Затраченное время по участникам и спринтам</span>
      </div>
    </template>

    <div v-if="isLoading" class="h-48 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="!hasUserData && !hasSprintData" class="h-48 flex flex-col items-center justify-center gap-2 text-muted">
      <UIcon name="i-lucide-timer-off" class="size-10" />
      <p class="text-sm">Нет записей о времени</p>
    </div>

    <template v-else>
      <VChart v-if="hasUserData" :option="barOption" autoresize class="h-48 mb-4" />

      <div v-if="hasSprintData" class="border-t border-default pt-3 space-y-1.5">
        <p class="text-xs text-muted mb-2">По спринтам</p>
        <div
          v-for="s in (report?.bySprint ?? [])"
          :key="s.sprintId"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-muted truncate max-w-[60%]">{{ s.sprintName }}</span>
          <span class="font-mono font-medium">{{ formatDuration(s.totalSeconds) }}</span>
        </div>
      </div>
    </template>
  </UCard>
</template>
