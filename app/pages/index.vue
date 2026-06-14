<script setup lang="ts">
import '~/assets/css/landing.css'

definePageMeta({ layout: false })

const root = ref<HTMLElement | null>(null)
useReveal(root)
useLenis()

useHead({
  title: 'ScrumBan — Scrumban-доска с прогнозом сроков для команд 30+',
  bodyAttrs: { class: 'landing-page' },
})
</script>

<template>
  <div ref="root" class="landing">
    <div class="grain" />
    <LandingNav />
    <LandingHero />
    <LandingManifesto />
    <LandingWhySection />
    <LandingWhatWorks />
    <LandingRoadmap />
    <LandingPilots />
    <LandingAbout />
    <LandingCtaForm />
    <LandingFooter />
  </div>
</template>