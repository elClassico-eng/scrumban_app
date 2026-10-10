<script setup lang="ts">
import { ROADMAP, ROADMAP_AREA, ROADMAP_STATUS, type RoadmapArea, type RoadmapStatus } from '~/utils/roadmap-data'

const statuses = Object.keys(ROADMAP_STATUS) as RoadmapStatus[]
const areas = Object.keys(ROADMAP_AREA) as RoadmapArea[]

const status = ref<RoadmapStatus>('done')
const area = ref<RoadmapArea | 'all'>('all')
const open = ref<string | null>(null)

const countBy = (s: RoadmapStatus) => ROADMAP.filter(i => i.status === s && (area.value === 'all' || i.area === area.value)).length
const items = computed(() => ROADMAP.filter(i => i.status === status.value && (area.value === 'all' || i.area === area.value)))
const doneTotal = computed(() => ROADMAP.filter(i => i.status === 'done').length)

const STATUS_DOT: Record<RoadmapStatus, string> = {
  done: 'bg-emerald-500',
  now: 'bg-accent-500',
  next: 'bg-blue-500',
  later: 'bg-neutral-400',
}
</script>

<template>
  <div class="not-prose my-6 space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-[13px] text-muted">
      <span>Реализовано {{ doneTotal }} из {{ ROADMAP.length }} пунктов</span>
      <div class="h-[6px] flex-1 min-w-[120px] rounded-full bg-elevated overflow-hidden">
        <div class="h-full bg-emerald-500 rounded-full" :style="{ width: `${Math.round((doneTotal / ROADMAP.length) * 100)}%` }" />
      </div>
    </div>

    <div class="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-elevated p-0.5">
      <button
        v-for="s in statuses"
        :key="s"
        type="button"
        class="h-8 cursor-pointer rounded-md px-3 text-[13px] font-medium transition-colors inline-flex items-center gap-2"
        :class="status === s ? 'bg-default text-default shadow-sm' : 'text-muted hover:text-default'"
        :title="ROADMAP_STATUS[s].hint"
        @click="status = s; open = null"
      >
        <span class="size-1.5 rounded-full" :class="STATUS_DOT[s]" />
        {{ ROADMAP_STATUS[s].label }}
        <span class="text-[11px] tabular-nums text-dimmed">{{ countBy(s) }}</span>
      </button>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="h-7 px-2.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors border"
        :class="area === 'all' ? 'border-accent-500 text-accent-500 bg-accent-500/5' : 'border-default text-muted hover:text-default'"
        @click="area = 'all'"
      >
        Все
      </button>
      <button
        v-for="a in areas"
        :key="a"
        type="button"
        class="h-7 px-2.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors border"
        :class="area === a ? 'border-accent-500 text-accent-500 bg-accent-500/5' : 'border-default text-muted hover:text-default'"
        @click="area = a"
      >
        {{ ROADMAP_AREA[a] }}
      </button>
    </div>

    <p class="m-0 text-[12.5px] text-muted">{{ ROADMAP_STATUS[status].hint }}</p>

    <div v-if="items.length === 0" class="py-10 text-center text-[13px] text-muted">
      В этой области пока ничего нет
    </div>

    <div v-else class="surface-soft rounded-2xl overflow-hidden divide-y divide-default">
      <div v-for="i in items" :key="i.id">
        <button
          type="button"
          class="w-full flex items-start gap-3 px-5 py-3.5 text-left cursor-pointer transition-colors hover:bg-elevated/40"
          @click="open = open === i.id ? null : i.id"
        >
          <span class="mt-[7px] size-1.5 rounded-full shrink-0" :class="STATUS_DOT[i.status]" />
          <span class="flex-1 min-w-0">
            <span class="flex items-center gap-2 flex-wrap">
              <span class="text-[14.5px] font-semibold text-default">{{ i.title }}</span>
              <span class="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-elevated text-muted">{{ ROADMAP_AREA[i.area] }}</span>
              <span v-if="i.release" class="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-500">релиз {{ i.release }}</span>
            </span>
            <span v-if="open !== i.id" class="block text-[13px] text-muted truncate mt-0.5">{{ i.text }}</span>
          </span>
          <UIcon name="i-lucide-chevron-down" class="size-4 text-muted shrink-0 mt-1 transition-transform" :class="open === i.id ? 'rotate-180' : ''" />
        </button>
        <div v-if="open === i.id" class="px-5 pb-4 pl-[38px] space-y-2">
          <p class="m-0 text-[13.5px] text-default leading-relaxed">{{ i.text }}</p>
          <p v-if="i.why" class="m-0 text-[12.5px] text-muted leading-relaxed"><span class="font-semibold text-default">Почему здесь:</span> {{ i.why }}</p>
          <NuxtLink v-if="i.docs" :to="i.docs" class="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-500 hover:underline">
            Подробнее в документации
            <UIcon name="i-lucide-arrow-right" class="size-3.5" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
