<script setup lang="ts">
import type { BurndownPoint } from '#shared/types/sprint'

const props = withDefaults(defineProps<{
  points: BurndownPoint[]
  height?: number
}>(), {
  height: 110,
})

const W = 320
const padL = 18
const padR = 8
const padT = 4
const padB = 16

const layout = computed(() => {
  const H = props.height
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const data = props.points
  if (data.length === 0) {
    return { H, innerW, innerH, maxV: 1, stepX: 0, idealPath: '', actualPath: '', areaPath: '', lastActual: null as null | { x: number; y: number } }
  }
  const maxV = Math.max(1, ...data.map(d => Math.max(d.ideal, d.actual ?? 0)))
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0
  const xy = (i: number, v: number): [number, number] => [padL + i * stepX, padT + innerH - (v / maxV) * innerH]
  const idealPoints = data.map((d, i) => xy(i, d.ideal))
  const actualPoints = data
    .map((d, i) => d.actual != null ? xy(i, d.actual) : null)
    .filter((p): p is [number, number] => p !== null)

  const idealPath = 'M' + idealPoints.map(p => p.join(',')).join('L')
  const actualPath = actualPoints.length > 0
    ? 'M' + actualPoints.map(p => p.join(',')).join('L')
    : ''
  const areaPath = actualPoints.length > 1
    ? `${actualPath} L${actualPoints[actualPoints.length - 1]![0]},${padT + innerH} L${padL},${padT + innerH}Z`
    : ''
  const lastActual = actualPoints.length > 0
    ? { x: actualPoints[actualPoints.length - 1]![0], y: actualPoints[actualPoints.length - 1]![1] }
    : null

  return { H, innerW, innerH, maxV: Math.round(maxV), stepX, idealPath, actualPath, areaPath, lastActual }
})
</script>

<template>
  <svg
    class="block w-full h-auto"
    :viewBox="`0 0 ${W} ${layout.H}`"
    preserveAspectRatio="none"
  >
    <line
      v-for="p in [0, 0.5, 1]"
      :key="p"
      :x1="padL"
      :x2="W - padR"
      :y1="padT + layout.innerH - p * layout.innerH"
      :y2="padT + layout.innerH - p * layout.innerH"
      stroke="#efeff1"
      stroke-width="1"
      stroke-dasharray="2 3"
    />
    <line
      :x1="padL"
      :x2="W - padR"
      :y1="padT + layout.innerH"
      :y2="padT + layout.innerH"
      stroke="#e8e8ea"
    />

    <path
      v-if="layout.idealPath"
      :d="layout.idealPath"
      fill="none"
      stroke="#b9b9c0"
      stroke-width="1.5"
      stroke-dasharray="4 3"
    />

    <path
      v-if="layout.areaPath"
      :d="layout.areaPath"
      fill="var(--ui-color-accent-500)"
      opacity="0.1"
    />
    <path
      v-if="layout.actualPath"
      :d="layout.actualPath"
      fill="none"
      stroke="var(--ui-color-accent-500)"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle
      v-if="layout.lastActual"
      :cx="layout.lastActual.x"
      :cy="layout.lastActual.y"
      r="3.5"
      fill="var(--ui-color-accent-500)"
      stroke="#fff"
      stroke-width="1.5"
    />

    <text
      :x="padL - 4"
      :y="padT + 6"
      font-size="9.5"
      text-anchor="end"
      fill="#8a8a93"
      font-family="JetBrains Mono, monospace"
    >
      {{ layout.maxV }}
    </text>
    <text
      :x="padL - 4"
      :y="padT + layout.innerH + 3"
      font-size="9.5"
      text-anchor="end"
      fill="#8a8a93"
      font-family="JetBrains Mono, monospace"
    >
      0
    </text>
    <text
      :x="padL"
      :y="layout.H - 3"
      font-size="9.5"
      fill="#8a8a93"
      font-family="JetBrains Mono, monospace"
    >
      старт
    </text>
    <text
      :x="W - padR"
      :y="layout.H - 3"
      font-size="9.5"
      text-anchor="end"
      fill="#8a8a93"
      font-family="JetBrains Mono, monospace"
    >
      финиш
    </text>
  </svg>
</template>
