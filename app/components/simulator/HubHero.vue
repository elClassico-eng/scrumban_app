<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

const collapsed = useLocalStorage('ui:simulator-hero-collapsed', false)

const steps = [
  {
    icon: 'i-lucide-sliders-horizontal',
    title: 'Соберите сценарий',
    text: 'Исключите задачу, переоцените срок, разорвите зависимость или сдвиньте дедлайн — виртуально.',
  },
  {
    icon: 'i-lucide-scale',
    title: 'Сравните прогнозы',
    text: 'Вероятность успеть и сроки P50/P85 пересчитываются мгновенно — до и после, с честной дельтой.',
  },
  {
    icon: 'i-lucide-check',
    title: 'Примените одним кликом',
    text: 'Понравившийся сценарий становится реальными действиями в спринте — одной транзакцией.',
  },
]
</script>

<template>
  <div
    v-if="collapsed"
    class="bg-black text-white rounded-2xl px-5 py-3 flex items-center gap-2.5"
  >
    <UIcon name="i-lucide-flask-conical" class="size-4 text-accent-500 shrink-0" />
    <span class="text-[13px] font-semibold">Симулятор решений</span>
    <span class="text-[12px] text-white/50 hidden sm:inline">— проверьте решение до того, как приняли его в спринте</span>
    <div class="flex-1" />
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-medium text-white/70 ring-1 ring-white/20 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      @click="collapsed = false"
    >
      <UIcon name="i-lucide-chevron-down" class="size-3.5" />
      Развернуть
    </button>
  </div>

  <div v-else class="relative overflow-hidden rounded-2xl bg-black text-white">
    <div class="absolute -top-24 -right-16 size-72 rounded-full bg-accent-600/30 blur-3xl pointer-events-none" />
    <div class="relative px-6 py-6 lg:px-8 lg:py-7 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
      <div class="space-y-3">
        <div class="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent-400">
          <UIcon name="i-lucide-flask-conical" class="size-3.5" />
          Флагманская фича
        </div>
        <h2 class="text-[24px] lg:text-[28px] font-semibold tracking-tight m-0 leading-tight text-white">
          Симулятор решений
        </h2>
        <p class="text-[14px] m-0 leading-relaxed text-white/90">
          Проверьте решение на симуляторе <b>до того</b>, как приняли его в спринте.
        </p>
        <p class="text-[12px] m-0 leading-relaxed text-white/55">
          Внутри — CPM, PERT и Монте-Карло по сети зависимостей. Оценки берутся из истории
          вашей команды, а не из ощущений.
        </p>
        <div class="flex items-center gap-2 pt-1">
          <NuxtLink
            to="/docs/math/simulator"
            class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold bg-white text-black hover:bg-white/90 transition-colors"
          >
            Как это работает
            <UIcon name="i-lucide-arrow-right" class="size-3.5" />
          </NuxtLink>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="(s, i) in steps"
          :key="s.title"
          class="flex items-start gap-3"
        >
          <div class="size-7 rounded-lg bg-accent-600/20 flex items-center justify-center shrink-0 mt-0.5">
            <UIcon :name="s.icon" class="size-3.5 text-accent-400" />
          </div>
          <div class="min-w-0">
            <div class="text-[12.5px] font-semibold text-white">{{ i + 1 }}. {{ s.title }}</div>
            <div class="text-[11.5px] text-white/55 leading-relaxed">{{ s.text }}</div>
          </div>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="absolute top-3 right-3 rounded-md p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      title="Свернуть"
      @click="collapsed = true"
    >
      <UIcon name="i-lucide-chevron-up" class="size-4 block" />
    </button>
  </div>
</template>
