<script setup lang="ts">
import { pageRoutes } from '~/routing'

const HINT_KEY = 'simulator-intro'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const { ready, isDismissed, dismiss } = useHints()

const expanded = computed(() => !isDismissed(HINT_KEY))

function tryIt() {
  dismiss(HINT_KEY)
}

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
    v-if="ready"
    class="hero relative overflow-hidden rounded-2xl bg-black text-white"
    :class="expanded ? 'hero-expanded' : 'hero-compact'"
  >
    <div
      class="absolute rounded-full bg-accent-600/30 blur-3xl pointer-events-none transition-all duration-700"
      :class="expanded ? '-top-32 -right-10 size-[28rem]' : '-top-24 -right-16 size-72'"
    />

    <div
      class="relative grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] transition-all duration-700"
      :class="expanded
        ? 'gap-10 px-8 py-10 lg:px-14 lg:py-14 items-center'
        : 'gap-7 px-6 py-7 lg:px-9 lg:py-8 items-start'"
    >
      <div :class="expanded ? 'space-y-5' : 'space-y-3'">
        <UIcon
          name="i-lucide-flask-conical"
          class="text-accent-400 transition-all duration-700"
          :class="expanded ? 'size-8' : 'size-5'"
        />
        <h2
          class="font-semibold tracking-tight m-0 leading-tight text-white transition-all duration-700"
          :class="expanded ? 'text-[34px] lg:text-[44px]' : 'text-[22px] lg:text-[26px]'"
        >
          Симулятор решений
        </h2>
        <p
          class="m-0 leading-relaxed text-white/90 transition-all duration-700"
          :class="expanded ? 'text-[17px] max-w-lg' : 'text-[13.5px] max-w-md'"
        >
          Проверьте решение на симуляторе <b>до того</b>, как вы приняли его в спринте.
        </p>
        <p
          class="m-0 leading-relaxed text-white/55 transition-all duration-700"
          :class="expanded ? 'text-[13.5px] max-w-lg' : 'text-[12px] max-w-md'"
        >
          Что резать из скоупа, стоит ли просить пару дней, какая блокировка на самом деле
          держит спринт — каждый вариант считается на модели и показывает эффект числом.
          Внутри — CPM, PERT и Монте-Карло по сети зависимостей; оценки берутся из истории
          вашей команды, а не из ощущений.
        </p>
        <div class="flex flex-wrap items-center gap-2.5 pt-1.5">
          <button
            v-if="expanded"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[14px] font-semibold bg-white text-black hover:bg-white/90 transition-colors cursor-pointer"
            @click="tryIt"
          >
            Попробовать
            <UIcon name="i-lucide-arrow-right" class="size-4" />
          </button>
          <NuxtLink
            to="/docs/math/simulator"
            class="inline-flex items-center gap-1.5 rounded-lg font-medium text-white/80 ring-1 ring-white/20 hover:text-white hover:bg-white/10 transition-colors"
            :class="expanded ? 'px-5 py-2.5 text-[14px]' : 'px-3.5 py-1.5 text-[12.5px]'"
          >
            Как это работает
          </NuxtLink>
          <NuxtLink
            :to="pageRoutes.simulatorDemo(wsId)"
            class="inline-flex items-center gap-1.5 rounded-lg font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            :class="expanded ? 'px-4 py-2.5 text-[14px]' : 'px-3 py-1.5 text-[12.5px]'"
          >
            <UIcon name="i-lucide-play" class="size-3.5" />
            Демо-пример
          </NuxtLink>
        </div>
      </div>

      <div :class="expanded ? 'space-y-5' : 'space-y-3'">
        <div
          v-for="(s, i) in steps"
          :key="s.title"
          class="flex items-start gap-3.5"
        >
          <div
            class="rounded-lg bg-accent-600/20 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-700"
            :class="expanded ? 'size-9' : 'size-7'"
          >
            <UIcon :name="s.icon" class="text-accent-400 transition-all duration-700" :class="expanded ? 'size-4.5' : 'size-3.5'" />
          </div>
          <div class="min-w-0">
            <div
              class="font-semibold text-white transition-all duration-700"
              :class="expanded ? 'text-[15px]' : 'text-[12.5px]'"
            >{{ i + 1 }}. {{ s.title }}</div>
            <div
              class="text-white/55 leading-relaxed transition-all duration-700"
              :class="expanded ? 'text-[13px]' : 'text-[11.5px]'"
            >{{ s.text }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  transition:
    min-height 700ms cubic-bezier(0.5, 0, 0.15, 1),
    border-radius 700ms cubic-bezier(0.5, 0, 0.15, 1);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-expanded {
  min-height: calc(100dvh - 11rem);
}

.hero-compact {
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .hero :deep(*) {
    transition: none !important;
  }
}
</style>
