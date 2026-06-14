<script setup lang="ts">
const goToApp = useAccessCta()
const wordmark = ref<HTMLElement | null>(null)
useWordmarkFit(wordmark)
</script>

<template>
  <header id="top" class="hero">
    <div class="hero__bg" :style="{ backgroundImage: 'url(/landing/hero-scene.webp)' }" />
    <div class="hero__scrim" />
    <div class="grain hero__grain" />

    <div class="wrap hero__meta">
      <div class="hero__kicker reveal"><span class="dot" />(01) — Открытая бета</div>
      <div class="hero__kicker right reveal">Scrumban OS · v0.9</div>
    </div>

    <div class="wrap hero__content">
      <div ref="wordmark" class="hero__wordmark reveal">
        <span class="line-mask"><span class="fit">ScrumBan<i class="star">*</i></span></span>
      </div>
      <div class="hero__lower">
        <div class="hero__tagline reveal">
          Сроки спринта — <span class="o">с вероятностью</span>,<br>а не на глаз.
        </div>
        <div class="hero__desc reveal">
          <p>Scrumban-доска для Scrum Master'ов команд 30+. Спринты задают ритм, аналитика потока — предсказуемость, а сроки считает математика (Monte Carlo, CPM/PERT), а не интуиция. Каждая цифра — с формулой.</p>
          <div class="hero__cta-row">
            <button class="btn btn--primary btn--static" @click="goToApp">
              Получить доступ
              <svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 12 4M6 4h6v6" /></svg>
            </button>
            <a class="btn btn--ghost" href="#what">
              Что работает
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M4 9l4 4 4-4" /></svg>
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="hero__scroll">
      <span>Scroll</span>
      <span class="ln" />
    </div>
  </header>
</template>