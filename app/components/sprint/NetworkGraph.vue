<script setup lang="ts">
import VChart from 'vue-echarts'
import type { NetworkTaskView } from '#shared/types/network'

const props = defineProps<{
  tasks: NetworkTaskView[]
  criticalPathIds: string[]
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const labelColor = computed(() => (isDark.value ? '#b7b8c0' : '#52525b'))
const accent = computed(() => (isDark.value ? '#ff6a1a' : '#e85002'))
const nodeMuted = computed(() => (isDark.value ? '#7e7f8a' : '#a1a1aa'))
const nodeBorder = computed(() => (isDark.value ? '#f4f4f6' : '#000000'))
const edgeMuted = computed(() => (isDark.value ? '#52525b' : '#d4d4d8'))

const hasEdges = computed(() =>
  props.tasks.some(t => t.dependsOn.some(dep => props.tasks.some(x => x.taskId === dep))),
)

const chainEdges = computed(() => {
  const set = new Set<string>()
  for (let i = 0; i < props.criticalPathIds.length - 1; i++) {
    set.add(`${props.criticalPathIds[i]}->${props.criticalPathIds[i + 1]}`)
  }
  return set
})

const positions = computed(() => {
  const sorted = [...props.tasks].sort(
    (a, b) => a.earlyStartDays - b.earlyStartDays || b.expectedDays - a.expectedDays,
  )
  const lanes: number[] = []
  const pos = new Map<string, { x: number; y: number }>()
  const maxFinish = Math.max(1, ...props.tasks.map(t => t.earlyFinishDays))
  for (const t of sorted) {
    let lane = lanes.findIndex(until => until <= t.earlyStartDays + 1e-6)
    if (lane === -1) {
      lanes.push(0)
      lane = lanes.length - 1
    }
    lanes[lane] = t.earlyFinishDays
    pos.set(t.taskId, { x: (t.earlyStartDays / maxFinish) * 760 + 40, y: lane * 80 + 40 })
  }
  return pos
})

const option = computed(() => {
  const critical = new Set(props.criticalPathIds)
  return {
    tooltip: {
      formatter: (p: { dataType: string; data: { id?: string; name?: string } }) => {
        if (p.dataType !== 'node' || !p.data.id) return ''
        const t = props.tasks.find(x => x.taskId === p.data.id)
        if (!t) return p.data.name ?? ''
        const status = t.critical ? 'критический путь' : `резерв ${t.slackDays} дн`
        return `${t.title}<br/>~${t.expectedDays} дн (${t.estimate.optimisticDays}–${t.estimate.pessimisticDays})<br/>${status}`
      },
    },
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      label: { show: true, position: 'bottom', fontSize: 11, width: 110, overflow: 'truncate', color: labelColor.value },
      data: props.tasks.map(t => ({
        id: t.taskId,
        name: t.title,
        x: positions.value.get(t.taskId)?.x ?? 0,
        y: positions.value.get(t.taskId)?.y ?? 0,
        symbolSize: Math.min(40, 14 + t.expectedDays * 4),
        itemStyle: {
          color: critical.has(t.taskId) ? accent.value : nodeMuted.value,
          borderColor: critical.has(t.taskId) ? nodeBorder.value : 'transparent',
          borderWidth: critical.has(t.taskId) ? 1.5 : 0,
        },
      })),
      links: props.tasks.flatMap(t =>
        t.dependsOn.map(dep => ({
          source: dep,
          target: t.taskId,
          lineStyle: {
            color: chainEdges.value.has(`${dep}->${t.taskId}`) ? accent.value : edgeMuted.value,
            width: chainEdges.value.has(`${dep}->${t.taskId}`) ? 2.5 : 1.2,
            curveness: 0.08,
          },
        })),
      ),
    }],
  }
})
</script>

<template>
  <div class="bg-default border border-default rounded-lg p-4">
    <template v-if="hasEdges">
      <VChart :option="option" autoresize class="w-full h-[320px]" />
      <p class="text-[11px] text-muted m-0 mt-1.5">
        Слева направо — раннее время старта · <span class="text-accent-600 font-medium">оранжевое</span> — критический путь · размер узла — ожидаемая длительность
      </p>
    </template>
    <template v-else>
      <div class="space-y-1.5">
        <div
          v-for="t in tasks"
          :key="t.taskId"
          class="flex items-center gap-2.5 px-2 py-1.5 text-[12.5px]"
        >
          <span class="size-1.5 rounded-full shrink-0 bg-zinc-300 dark:bg-zinc-600" />
          <span class="truncate text-default">{{ t.title }}</span>
          <span class="ml-auto shrink-0 tabular-nums text-[11px] text-muted">~{{ t.expectedDays }} дн</span>
        </div>
      </div>
      <p class="text-[11px] text-muted m-0 mt-1.5">
        Между открытыми задачами нет зависимостей — сеть вырождается в параллельный список.
        Добавьте зависимости, чтобы увидеть граф и критический путь.
      </p>
    </template>
  </div>
</template>