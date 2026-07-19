<script setup lang="ts">
type Phase = { key: string, chip: 'done' | 'dev' | 'plan', when: string, title: string, tone: '' | 'haze1' | 'haze2', items: string[] }

const PHASES: Phase[] = [
  { key: 'now', chip: 'done', when: 'Сейчас', title: 'Рабочий продукт', tone: '', items: [
    'Доска, спринты, WIP-лимиты, классы обслуживания',
    'Аналитика потока: CFD, cycle time, throughput',
    'Прогноз сроков: Monte Carlo, CPM/PERT',
    'Отчёты спринтов, ретроспективы, дейли-дайджест',
    'Симулятор решений what-if',
    'Real-time (SSE), роли, изоляция данных (RLS)',
  ] },
  { key: 'soon', chip: 'dev', when: 'Скоро', title: 'Интеграции и автоматизации', tone: 'haze1', items: [
    'GitFlic и Pachca',
    'Уведомления в мессенджеры',
    'Автоматизации потока: триггеры от математики',
  ] },
  { key: 'later', chip: 'plan', when: 'Дальше', title: 'Экосистема', tone: 'haze2', items: [
    '1С и Yandex Cloud',
    'On-prem / self-hosting',
    'Публичный API',
  ] },
]

const track = ref<HTMLElement | null>(null)
const progress = ref(0)

function onTrackScroll() {
  const el = track.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  progress.value = max > 0 ? el.scrollLeft / max : 0
}

function shift(dir: -1 | 1) {
  track.value?.scrollBy({ left: dir * 540, behavior: 'smooth' })
}
</script>

<template>
  <section id="roadmap" class="section rmap2">
    <div class="wrap">
      <div class="rmap2__head reveal">
        <p class="eyebrow">Куда движемся</p>
        <h2>Честный roadmap</h2>
      </div>
    </div>
    <div ref="track" class="rmap2__track" @scroll.passive="onTrackScroll">
      <article v-for="ph in PHASES" :key="ph.key" class="rmap2__card" :class="ph.tone && `rmap2__card--${ph.tone}`">
        <div class="rmap2__meta">
          <span class="rmap2__when">{{ ph.when }}</span>
          <LandingStatusChip :kind="ph.chip" />
        </div>
        <h3>{{ ph.title }}</h3>
        <ul>
          <li v-for="it in ph.items" :key="it">{{ it }}</li>
        </ul>
      </article>
    </div>
    <div class="wrap rmap2__ctrl">
      <button class="rmap2__arrow" aria-label="Назад" @click="shift(-1)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
      </button>
      <button class="rmap2__arrow" aria-label="Вперёд" @click="shift(1)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </button>
      <div class="rmap2__bar"><i :style="{ width: `${8 + progress * 92}%` }" /></div>
    </div>
  </section>
</template>
