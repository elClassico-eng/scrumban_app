<script setup lang="ts">
import VChart from 'vue-echarts'

const props = defineProps<{ weeks: { label: string; value: number }[] }>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const accent = computed(() => (isDark.value ? '#ff6a1a' : '#e85002'))
const axis = computed(() => (isDark.value ? '#7e7f8a' : '#9b9ba3'))
const split = computed(() => (isDark.value ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'))

const option = computed(() => ({
  grid: { top: 14, left: 6, right: 12, bottom: 22, containLabel: true },
  tooltip: {
    trigger: 'axis',
    confine: true,
    formatter: (params: { axisValue: string, data: number }[]) => {
      const p = params[0]
      if (!p) return ''
      return `Неделя с ${p.axisValue}<br/>Закрыто: <b>${p.data}</b> ${plural(p.data, ['задача', 'задачи', 'задач'])}`
    },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.weeks.map(w => w.label),
    axisLine: { lineStyle: { color: split.value } },
    axisTick: { show: false },
    axisLabel: { color: axis.value, fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    splitLine: { lineStyle: { color: split.value } },
    axisLabel: { color: axis.value, fontSize: 10 },
  },
  series: [{
    type: 'line',
    smooth: 0.35,
    showSymbol: false,
    lineStyle: { width: 2.5, color: accent.value },
    itemStyle: { color: accent.value },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: isDark.value ? 'rgba(255,106,26,.35)' : 'rgba(232,80,2,.26)' },
          { offset: 1, color: isDark.value ? 'rgba(255,106,26,0)' : 'rgba(232,80,2,0)' },
        ],
      },
    },
    data: props.weeks.map(w => w.value),
  }],
}))
</script>

<template>
  <VChart :option="option" autoresize class="h-48 w-full" />
</template>
