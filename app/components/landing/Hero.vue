<script setup lang="ts">
const goToApp = useAccessCta()
</script>

<template>
  <header id="top" class="hero">
    <div class="cone" aria-hidden="true">
      <i class="cone__l cone__l--1" /><i class="cone__l cone__l--2" /><i class="cone__l cone__l--3" />
      <svg class="cone__arcs" viewBox="0 0 1200 500" fill="none" preserveAspectRatio="xMidYMax meet">
        <path d="M100 500 Q 600 90 1100 500" stroke="currentColor" stroke-width="1" opacity="0.28" />
        <path d="M210 500 Q 600 190 990 500" stroke="currentColor" stroke-width="1" opacity="0.34" />
        <path d="M330 500 Q 600 290 870 500" stroke="currentColor" stroke-width="1" opacity="0.4" />
        <text x="600" y="120" text-anchor="middle" class="cone__t">P95</text>
        <text x="600" y="218" text-anchor="middle" class="cone__t">P85</text>
        <text x="600" y="316" text-anchor="middle" class="cone__t">P50</text>
      </svg>
    </div>

    <div class="wrap hero__content">
      <div class="chip reveal"><span class="pulse" />Открытая бета v0.1</div>
      <h1 class="hero__h1 reveal">
        Сроки спринта – <span class="hl">с вероятностью</span>,<br>а не на глаз.
      </h1>
      <p class="hero__sub reveal">
        Scrumban-доска, где сроки спринта считает математика:
        Monte Carlo и CPM/PERT, а не интуиция.
      </p>
      <div class="hero__cta reveal">
        <button class="btn btn--dark" @click="goToApp">Получить доступ</button>
        <NuxtLink class="btn btn--light" to="/docs" external>Документация</NuxtLink>
      </div>
    </div>
  </header>
</template>
