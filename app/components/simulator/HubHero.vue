<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

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
  <div class="relative overflow-hidden rounded-2xl bg-black text-white">
    <div class="absolute -top-24 -right-16 size-72 rounded-full bg-accent-600/30 blur-3xl pointer-events-none" />
    <div class="relative px-6 py-7 lg:px-9 lg:py-8 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-7 items-start">
      <div class="space-y-3">
        <UIcon name="i-lucide-flask-conical" class="size-5 text-accent-400" />
        <h2 class="text-[22px] lg:text-[26px] font-semibold tracking-tight m-0 leading-tight text-white">
          Симулятор решений
        </h2>
        <p class="text-[13.5px] m-0 leading-relaxed text-white/90 max-w-md">
          Проверьте решение на симуляторе <b>до того</b>, как вы приняли его в спринте.
        </p>
        <p class="text-[12px] m-0 leading-relaxed text-white/55 max-w-md">
          Что резать из скоупа, стоит ли просить пару дней, какая блокировка на самом деле
          держит спринт — каждый вариант считается на модели и показывает эффект числом.
          Внутри — CPM, PERT и Монте-Карло по сети зависимостей; оценки берутся из истории
          вашей команды, а не из ощущений.
        </p>
        <div class="flex flex-wrap items-center gap-2.5 pt-1.5">
          <NuxtLink
            to="/docs/math/simulator"
            class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium text-white/80 ring-1 ring-white/20 hover:text-white hover:bg-white/10 transition-colors"
          >
            Как это работает
          </NuxtLink>
          <NuxtLink
            :to="pageRoutes.simulatorDemo(wsId)"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <UIcon name="i-lucide-play" class="size-3.5" />
            Демо-пример
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
  </div>
</template>
