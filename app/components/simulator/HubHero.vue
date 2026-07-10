<script setup lang="ts">
const HINT_KEY = 'simulator-intro'

const { ready, isDismissed, dismiss } = useHints()

const closing = ref(false)
const show = computed(() => ready.value && !closing.value && !isDismissed(HINT_KEY))

function tryIt() {
  closing.value = true
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
  <Transition name="absorb">
    <div v-if="show" class="absorb-block relative overflow-hidden rounded-2xl bg-black text-white">
      <div class="absolute -top-24 -right-16 size-72 rounded-full bg-accent-600/30 blur-3xl pointer-events-none" />
      <div class="relative px-6 py-7 lg:px-9 lg:py-9 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-7">
        <div class="space-y-3.5">
          <div class="inline-flex items-center gap-2 text-accent-400">
            <UIcon name="i-lucide-flask-conical" class="size-5" />
          </div>
          <h2 class="text-[26px] lg:text-[32px] font-semibold tracking-tight m-0 leading-tight text-white">
            Симулятор решений
          </h2>
          <p class="text-[15px] m-0 leading-relaxed text-white/90 max-w-md">
            Проверьте решение на симуляторе <b>до того</b>, как вы приняли его в спринте.
          </p>
          <p class="text-[12.5px] m-0 leading-relaxed text-white/55 max-w-md">
            Что резать из скоупа, стоит ли просить пару дней, какая блокировка на самом деле
            держит спринт — каждый вариант считается на модели и показывает эффект числом.
            Внутри — CPM, PERT и Монте-Карло по сети зависимостей; оценки берутся из истории
            вашей команды, а не из ощущений.
          </p>
          <div class="flex items-center gap-2.5 pt-1.5">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold bg-white text-black hover:bg-white/90 transition-colors cursor-pointer"
              @click="tryIt"
            >
              Попробовать
              <UIcon name="i-lucide-arrow-right" class="size-3.5" />
            </button>
            <NuxtLink
              to="/docs/math/simulator"
              class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-white/80 ring-1 ring-white/20 hover:text-white hover:bg-white/10 transition-colors"
            >
              Как это работает
            </NuxtLink>
          </div>
        </div>

        <div class="space-y-3.5 lg:pt-1">
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
  </Transition>
</template>

<style scoped>
.absorb-block {
  max-height: 640px;
}

.absorb-leave-active {
  animation: absorb 640ms cubic-bezier(0.55, -0.02, 0.2, 1) forwards;
  transform-origin: 50% 24%;
  pointer-events: none;
}

@keyframes absorb {
  0% {
    max-height: 640px;
    opacity: 1;
    transform: scale(1);
    border-radius: 16px;
  }
  45% {
    opacity: 0.85;
    transform: scale(0.965);
    border-radius: 36px;
  }
  100% {
    max-height: 0;
    opacity: 0;
    transform: scale(0.8);
    border-radius: 120px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .absorb-leave-active {
    animation: none;
    transition: opacity 200ms ease;
  }
  .absorb-leave-to {
    opacity: 0;
  }
}
</style>
