<script setup lang="ts">
import VChart from 'vue-echarts'

const props = defineProps<{
  segments: { name: string; value: number; color: string }[]
  total: number
  centerLabel?: string
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const option = computed(() => ({
  tooltip: { trigger: 'item', confine: true },
  series: [{
    type: 'pie',
    radius: ['62%', '88%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: false,
    itemStyle: { borderColor: isDark.value ? '#16161a' : '#ffffff', borderWidth: 3 },
    label: { show: false },
    labelLine: { show: false },
    data: props.segments.map(s => ({
      name: s.name,
      value: s.value,
      itemStyle: { color: s.color },
    })),
  }],
}))
</script>

<template>
  <div class="relative h-48">
    <VChart :option="option" autoresize class="h-48 w-full" />
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-3xl font-bold leading-none text-default">{{ total }}</span>
      <span class="text-[11px] text-muted">{{ centerLabel ?? 'задач' }}</span>
    </div>
  </div>
</template>
