<script setup lang="ts">
const props = defineProps<{
  pct: number
  caption: string
  reducedMotion?: boolean
}>()

const ringSize = 78
const ringR = computed(() => ringSize / 2 - 6)
const ringC = computed(() => 2 * Math.PI * ringR.value)
const ringOffset = computed(() => ringC.value * (1 - props.pct / 100))
</script>

<template>
  <div
    class="rounded-2xl p-[13px] flex flex-col items-center justify-center text-center"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Спринт</div>
    <div class="relative w-[78px] h-[78px]">
      <svg
        :width="ringSize"
        :height="ringSize"
        :viewBox="`0 0 ${ringSize} ${ringSize}`"
        style="transform: rotate(-90deg);"
      >
        <circle
          :cx="ringSize / 2"
          :cy="ringSize / 2"
          :r="ringR"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          stroke-width="6"
        />
        <circle
          :cx="ringSize / 2"
          :cy="ringSize / 2"
          :r="ringR"
          fill="none"
          stroke="url(#ccRingGrad)"
          stroke-width="6"
          stroke-linecap="round"
          :stroke-dasharray="ringC"
          :stroke-dashoffset="ringOffset"
          :style="reducedMotion ? {} : { transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }"
        />
        <defs>
          <linearGradient id="ccRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--island-orange-2)" />
            <stop offset="100%" stop-color="var(--island-orange-deep)" />
          </linearGradient>
        </defs>
      </svg>
      <div class="absolute inset-0 grid place-items-center">
        <div class="flex flex-col items-center">
          <b class="text-[19px] font-bold tracking-[-0.02em] text-[var(--island-ink)]">{{ pct }}%</b>
          <span class="text-[9px] text-[var(--island-ink-3)] uppercase tracking-[0.05em]">спринт</span>
        </div>
      </div>
    </div>
    <div class="text-[11px] text-[var(--island-ink-2)] mt-2">{{ caption }}</div>
  </div>
</template>
