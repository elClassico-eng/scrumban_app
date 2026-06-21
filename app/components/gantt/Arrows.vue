<script setup lang="ts">
import type { EdgeSegment } from '~/utils/gantt'

const props = defineProps<{
  segments: EdgeSegment[]
  width: number
  height: number
}>()

const paths = computed(() =>
  props.segments.map((s) => {
    const ctrl = Math.max(16, (s.x2 - s.x1) / 2)
    return `M ${s.x1} ${s.y1} C ${s.x1 + ctrl} ${s.y1}, ${s.x2 - ctrl} ${s.y2}, ${s.x2} ${s.y2}`
  }),
)
</script>

<template>
  <svg
    class="absolute top-0 left-0 pointer-events-none text-dimmed"
    :width="width"
    :height="height"
  >
    <defs>
      <marker
        id="gantt-arrow"
        viewBox="0 0 6 6"
        refX="5"
        refY="3"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
      </marker>
    </defs>
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      marker-end="url(#gantt-arrow)"
    />
  </svg>
</template>
