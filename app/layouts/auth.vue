<script setup lang="ts">
const route = useRoute()
const cardMaxWidth = computed(() => (route.meta.cardMaxWidth as string | undefined) ?? 'lg:max-w-md')
const stepper = useAuthStepper()

type Slide = { text: string, by: string }

const SLIDES: Slide[] = [
  {
    text: 'Сроки спринта — с вероятностью, а не на глаз. Поток и прогноз считает математика, а не интуиция.',
    by: 'Scrumban-платформа для команд 30+',
  },
  {
    text: 'P50, P85 и P95 вместо «успеем / не успеем»: 5000 симуляций Monte Carlo на каждый прогноз.',
    by: 'Вероятностное прогнозирование',
  },
  {
    text: 'Симулятор what-if: проверьте перенос дедлайна или исключение задачи до того, как приняли решение.',
    by: 'Симулятор решений',
  },
  {
    text: 'WIP-лимиты не «на глаз», а по закону Литтла: рекомендация выводится из throughput и cycle time команды.',
    by: 'Дисциплина потока',
  },
]

const autoIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const slideIndex = computed(() => {
  if (stepper.value) return Math.min(stepper.value.step.value - 1, SLIDES.length - 1)
  return autoIndex.value
})
const slide = computed(() => SLIDES[slideIndex.value]!)

onMounted(() => {
  timer = setInterval(() => {
    if (!stepper.value) autoIndex.value = (autoIndex.value + 1) % SLIDES.length
  }, 6000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="auth2">
    <div class="auth2__form">
      <div :class="['auth2__inner', cardMaxWidth]">
        <div class="auth2__top">
          <span class="auth2__mark"><TaktMark /></span>
          <NuxtLink to="/" external class="auth2__home">
            <UIcon name="i-lucide-arrow-left" class="size-3.5" /> На главную
          </NuxtLink>
        </div>
        <slot />
      </div>
    </div>

    <aside class="auth2__promo">
      <div class="auth2__card">
        <div class="auth2__head" aria-hidden="true">
          <span class="auth2__wordmark"><TaktMark class="auth2__wordmark-mark" />Такт<i>*</i></span>
          <LandingSpinningBadge text="monte carlo · cpm · pert · little's law · " class="auth2__badge" />
        </div>
        <div class="auth2__chips" aria-hidden="true">
          <span>Scrumban-доска</span>
          <span>Аналитика потока</span>
        </div>
        <div class="auth2__quote" aria-hidden="true">
          <Transition name="aslide" mode="out-in">
            <div :key="slideIndex" class="auth2__slide">
              <p>{{ slide.text }}</p>
              <div class="auth2__by">
                <b>Такт</b>
                <span>{{ slide.by }}</span>
              </div>
            </div>
          </Transition>
          <div class="auth2__dots">
            <i v-for="(s, i) in SLIDES" :key="s.by" :class="{ on: i === slideIndex }" />
          </div>
        </div>

      </div>

      <Transition name="anav">
        <div v-if="stepper" class="auth2__nav">
          <button
            type="button"
            aria-label="Предыдущий шаг"
            :disabled="stepper.step.value <= 1"
            @click="stepper.prev()"
          >
            <UIcon name="i-lucide-arrow-left" class="size-4" />
          </button>
          <button
            type="button"
            aria-label="Следующий шаг"
            :disabled="stepper.step.value >= stepper.total"
            @click="stepper.next()"
          >
            <UIcon name="i-lucide-arrow-right" class="size-4" />
          </button>
        </div>
      </Transition>
    </aside>
  </div>
</template>

<style scoped>
.auth2 {
  --page-bg: #FBFAF8;
  min-height: 100dvh;
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
  background:
    radial-gradient(46% 38% at 82% 6%, #FFE9DC 0%, transparent 62%),
    radial-gradient(38% 34% at 100% 48%, rgba(255, 223, 201, 0.5) 0%, transparent 64%),
    var(--page-bg);
}
.auth2__form {
  flex: 0 1 760px;
  height: 100dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: clamp(24px, 5vw, 64px);
}
.auth2__inner {
  width: 100%;
  margin: auto;
  color: #111110;
}

.auth2__form :deep(h1) {
  color: #111110;
  letter-spacing: -0.02em;
}
.auth2__form :deep(.text-muted) { color: #6b6963; }
.auth2__form :deep(.text-primary) { color: var(--color-accent-600); }

.auth2__form :deep(:is(input:not([type="checkbox"]), textarea)) {
  border-radius: 14px;
  font-size: 15px;
  padding-block: 13px;
  --tw-ring-color: rgba(17, 17, 16, 0.14);
}
.auth2__form :deep(:is(input, textarea):focus-visible) {
  --tw-ring-color: var(--color-accent-500);
}

.auth2__form :deep(.bg-primary) {
  background: linear-gradient(180deg, var(--color-accent-400), var(--color-accent-600));
}
.auth2__form :deep(button.bg-primary),
.auth2__form :deep(a.bg-primary) {
  border-radius: 14px;
  padding-block: 17px;
  box-shadow: 0 12px 26px -12px rgba(232, 80, 2, 0.55);
  transition: filter 0.2s ease, transform 0.2s ease;
}
.auth2__form :deep(:is(button, a).bg-primary:hover) {
  filter: brightness(1.05);
}
.auth2__form :deep(:is(button, a).bg-primary:active) {
  transform: translateY(1px);
}
.auth2__top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 32px;
}
.auth2__mark {
  display: grid; place-items: center;
  width: 34px; height: 34px;
  color: var(--color-accent-500);
}
.auth2__mark :deep(svg) { width: 100%; height: 100%; }
.auth2__home {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 13px; color: #6b6963;
  transition: color 0.2s ease;
}
.auth2__home:hover { color: #111110; }

.auth2__promo {
  --pad: 28px;
  --tab-r: 26px;
  position: relative;
  flex: 0 1 clamp(480px, 46vw, 760px);
  padding: var(--pad);
  padding-right: 0;
}
.auth2__card {
  position: relative;
  height: 100%;
  min-height: 34rem;
  border-radius: 28px;
  overflow: hidden;
  display: flex; flex-direction: column; justify-content: flex-end;
  gap: 14px;
  padding: 28px;
}
.auth2__card::before {
  content: "";
  position: absolute;
  inset: -72px;
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.3) 100%),
    url("/auth/gradient.webp") center / cover no-repeat;
  animation: auth-drift 14s ease-in-out infinite alternate;
}

@keyframes auth-drift {
  0% { transform: translate(-28px, 20px) scale(1) rotate(0deg); }
  50% { transform: translate(18px, -12px) scale(1.1) rotate(1.6deg); }
  100% { transform: translate(-14px, -26px) scale(1.2) rotate(-1.4deg); }
}
.auth2__head {
  position: relative; z-index: 1;
  margin-bottom: auto;
  display: flex; align-items: flex-start; justify-content: space-between;
}
.auth2__wordmark {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: "Unbounded", "Onest", sans-serif;
  font-size: 20px; font-weight: 600;
  color: #fff;
}
.auth2__wordmark i { font-style: normal; color: #fff; opacity: 0.85; }
.auth2__wordmark-mark { width: 26px; height: 26px; }
.auth2__badge { width: 118px; height: 118px; flex: 0 0 118px; }
.auth2__badge :deep(.sbadge__ring),
.auth2__badge:deep(svg) { width: 100%; height: 100%; }
.auth2__badge :deep(text) {
  font-family: ui-monospace, monospace;
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  fill: rgba(255, 255, 255, 0.85);
}
.auth2__badge { position: relative; display: grid; place-items: center; animation: none; }
.auth2__badge :deep(svg:first-of-type) { animation: auth-spin 20s linear infinite; }
.auth2__badge :deep(.sbadge__center) {
  position: absolute;
  width: 30px; height: 30px;
  color: #fff;
}
.auth2__badge :deep(.sbadge__center svg) { width: 100%; height: 100%; animation: none; }

@keyframes auth-spin {
  to { transform: rotate(360deg); }
}

.auth2__chips {
  position: relative; z-index: 1;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.auth2__chips span {
  padding: 7px 13px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.26);
  font-size: 12px; color: #fff;
}
.auth2__quote {
  position: relative; z-index: 1;
  max-width: 540px;
  margin-right: auto;
  border-radius: 22px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.auth2__quote { min-height: 208px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; }
.auth2__quote p {
  font-size: 22px; line-height: 1.32; font-weight: 500; color: #fff;
  letter-spacing: -0.01em;
  max-width: 30ch;
}
.auth2__dots { display: flex; gap: 6px; }
.auth2__dots i {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  transition: background 0.3s ease, width 0.3s ease;
}
.auth2__dots i.on {
  width: 18px;
  border-radius: 999px;
  background: #fff;
}

.aslide-enter-active, .aslide-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.aslide-enter-from { opacity: 0; transform: translateX(14px); }
.aslide-leave-to { opacity: 0; transform: translateX(-14px); }
.auth2__by {
  margin-top: 18px;
  display: flex; flex-direction: column; gap: 2px;
}
.auth2__by b { font-size: 13px; font-weight: 600; color: #fff; }
.auth2__by span { font-size: 11.5px; color: rgba(255, 255, 255, 0.72); }

.auth2__nav {
  position: absolute;
  right: 0;
  bottom: var(--pad);
  z-index: 2;
  display: flex; gap: 12px;
  padding: 20px 0 0 20px;
  background: var(--page-bg);
  border-top-left-radius: var(--tab-r);
}
.auth2__nav::before,
.auth2__nav::after {
  content: "";
  position: absolute;
  width: var(--tab-r);
  height: var(--tab-r);
  background: radial-gradient(circle at top left, transparent calc(var(--tab-r) - 0.5px), var(--page-bg) var(--tab-r));
}
.auth2__nav::before {
  right: 0;
  top: calc(-1 * var(--tab-r));
}
.auth2__nav::after {
  bottom: 0;
  left: calc(-1 * var(--tab-r));
}
.auth2__nav button {
  display: grid; place-items: center;
  width: 84px; height: 62px;
  border-radius: 20px;
  border: 1px solid rgba(17, 17, 16, 0.1);
  background: #fff;
  color: #111110;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}
.auth2__nav button:hover:not(:disabled) { transform: translateY(-2px); border-color: rgba(17, 17, 16, 0.28); }
.auth2__nav button:disabled { opacity: 0.35; cursor: default; }

.anav-enter-active, .anav-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.anav-enter-from, .anav-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 1023px) {
  .auth2__promo { display: none; }
  .auth2__form { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .anav-enter-active, .anav-leave-active { transition: none; }
  .auth2__nav button { transition: none; }
  .auth2__card::before { animation: none; }
  .aslide-enter-active, .aslide-leave-active { transition: none; }
  .auth2__badge :deep(svg:first-of-type) { animation: none; }
}
</style>
