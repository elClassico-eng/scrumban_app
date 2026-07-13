<script setup lang="ts">
import '~/assets/css/landing.css'

definePageMeta({ layout: false })

const root = ref<HTMLElement | null>(null)
useReveal(root)
useLenis()

useHead({
  bodyAttrs: { class: 'landing-page' },
  link: [{ rel: 'canonical', href: 'https://takt34.tech/' }],
})

useSeoMeta({
  title: 'Такт — Scrumban-доска с прогнозом сроков для команд 30+',
  description: 'Scrumban-доска для IT-команд от 30 человек. Спринты задают ритм, аналитика потока — предсказуемость, а сроки спринта считает математика (Monte Carlo, CPM/PERT), а не интуиция.',
  ogType: 'website',
  ogSiteName: 'Такт',
  ogTitle: 'Такт — Scrumban-доска с прогнозом сроков',
  ogDescription: 'Спринты задают ритм, аналитика потока — предсказуемость, а сроки спринта считает математика, а не интуиция. Для IT-команд от 30 человек.',
  ogUrl: 'https://takt34.tech/',
  ogImage: 'https://takt34.tech/landing/board.webp',
  ogLocale: 'ru_RU',
})
</script>

<template>
  <div ref="root" class="landing">
    <LandingNav />
    <LandingHero />
    <LandingBento />
    <LandingProduct />
    <LandingRoadmap />
    <LandingPilots />
    <LandingCtaForm />
    <LandingFooter />
  </div>
</template>