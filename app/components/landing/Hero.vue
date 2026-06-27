<script setup lang="ts">
const goToApp = useAccessCta()
const palette = useBrandPalette()
</script>

<template>
  <header id="top" class="hero">
    <div class="hero__bg">
      <ClientOnly>
        <LandingColorBends
          :colors="palette"
          :speed="0.16"
          :scale="1.4"
          :rotation="90"
          :auto-rotate="2"
          :frequency="1"
          :warp-strength="1.2"
          :mouse-influence="0.6"
          :parallax="0.4"
          :noise="0.08"
          :iterations="2"
          :intensity="1"
          :band-width="6"
          transparent
        />
      </ClientOnly>
    </div>
    <div class="hero__scrim" />
    <div class="grain hero__grain" />

    <div class="wrap hero__content">
      <div class="hero__kicker reveal"><span class="dot" />Открытая бета v0.1</div>
      <div class="hero__wordmark reveal">
        <span class="line-mask"><span class="fit">Такт<i class="star">*</i></span></span>
      </div>
      <h1 class="hero__tagline reveal">
        Сроки спринта — <span class="o">с вероятностью</span>,<br>а не на глаз.
      </h1>
      <div class="hero__cta-row reveal">
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

    <div class="hero__scroll">
      <span>Scroll</span>
      <span class="ln" />
    </div>
  </header>
</template>