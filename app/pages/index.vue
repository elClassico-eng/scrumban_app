<script setup lang="ts">
import '~/assets/css/landing.css'

definePageMeta({ layout: false })

const root = ref<HTMLElement | null>(null)
useReveal(root)

const { start, startLabel } = useAccessCta()

useHead({
  link: [{ rel: 'canonical', href: 'https://takt34.tech/' }],
})

useSeoMeta({
  title: 'Такт – Scrumban-доска с прогнозом сроков для команд 30+',
  description: 'Scrumban-доска для IT-команд от 30 человек. Спринты задают ритм, аналитика потока – предсказуемость, а сроки спринта считает математика (Monte Carlo, CPM/PERT), а не интуиция.',
  ogType: 'website',
  ogSiteName: 'Такт',
  ogTitle: 'Такт – Scrumban-доска с прогнозом сроков',
  ogDescription: 'Спринты задают ритм, аналитика потока – предсказуемость, а сроки спринта считает математика, а не интуиция. Для IT-команд от 30 человек.',
  ogUrl: 'https://takt34.tech/',
  ogImage: 'https://takt34.tech/landing/board.webp',
  ogLocale: 'ru_RU',
})
</script>

<template>
  <div id="top" ref="root" class="landing">
    <LandingPageLoader />
    <LandingAnnounceBar />
    <LandingHeader />

    <main>
      <section class="wrap" style="padding: 96px 0 48px; text-align: center">
        <h1 style="font-size: clamp(36px, 7vw, 64px); line-height: 1.04">Сроки спринта – с вероятностью, а не на глаз</h1>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 32px" data-cta-start>
          <button type="button" class="btn btn--dark btn--lg" @click="start">{{ startLabel }}</button>
          <a class="btn btn--ghost btn--lg" href="#pilot">Стать пилотной командой →</a>
        </div>
      </section>

      <div id="features" />
      <div id="forecast" />
      <div id="integrations" />
      <div id="updates" />
      <div id="plans" />
      <div id="pilot" />

      <section class="wrap" style="padding: 120px 0 80px; text-align: center" data-cta-end>
        <h2>Задайте команде ритм</h2>
      </section>
    </main>

    <LandingFooter />
    <LandingFloatingCta />
  </div>
</template>
