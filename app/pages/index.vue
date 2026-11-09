<script setup lang="ts">
import '~/assets/css/landing.css'
import { latestRelease, recentReleases, type ReleaseEntry } from '~/utils/landing-releases'

definePageMeta({ layout: false })

const root = ref<HTMLElement | null>(null)
useReveal(root)

const { data: entries } = await useAsyncData('landing-releases', async () => {
  try {
    const rows = await queryCollection('changelog').order('date', 'DESC').all()
    return rows.map((r): ReleaseEntry => ({ title: r.title, date: r.date, version: r.version, summary: r.summary, path: r.path }))
  }
  catch {
    return []
  }
}, { default: () => [] as ReleaseEntry[] })

const releases = computed(() => recentReleases(entries.value))
const latest = computed(() => {
  const r = latestRelease(entries.value)
  return r?.version ? { version: r.version, title: r.title } : null
})

useHead({
  link: [{ rel: 'canonical', href: 'https://takt34.tech/' }],
})

useSeoMeta({
  title: 'Такт – Scrumban-доска с прогнозом сроков',
  description: 'Scrumban-доска, которая по истории вашей команды считает, когда работа будет готова: вероятность сроков вместо оценки на глаз. Бесплатная бета для IT-команд.',
  ogType: 'website',
  ogSiteName: 'Такт',
  ogTitle: 'Такт – сроки спринта с вероятностью, а не на глаз',
  ogDescription: 'Scrumban-доска с прогнозом сроков по истории команды. Бесплатная бета, ищу первые пилотные команды.',
  ogUrl: 'https://takt34.tech/',
  ogImage: 'https://takt34.tech/landing/board.webp',
  ogLocale: 'ru_RU',
})
</script>

<template>
  <div id="top" ref="root" class="landing">
    <LandingPageLoader />
    <LandingHeader />

    <main>
      <LandingHero :release="latest" />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingDifference />
      <LandingIntegrations />
      <LandingFullBleed />
      <LandingDataSecurity />
      <LandingReleases :releases="releases" />
      <LandingAbout />
      <LandingPilotForm />
      <LandingFaq />
      <LandingFinalCta />
    </main>

    <LandingFooter />
    <LandingFloatingCta />
  </div>
</template>
