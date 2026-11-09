<script setup lang="ts">
defineProps<{ release: { version: string, title: string } | null }>()

const { start, startLabel } = useAccessCta()
</script>

<template>
  <section class="hero">
    <div class="wrap">
      <a v-if="release" class="hero__chip reveal" href="#updates">✦ {{ release.title }} →</a>
      <h1 class="hero__h1 reveal">Сроки спринта – <em>с&nbsp;вероятностью</em>,<br class="hero__br"> а&nbsp;не&nbsp;на&nbsp;глаз</h1>
      <p class="hero__sub muted reveal">
        Scrumban-доска, которая по истории вашей команды считает, когда работа будет готова. Бесплатно, пока идёт бета.
      </p>
      <div class="hero__cta reveal" data-cta-start>
        <button type="button" class="btn btn--dark btn--lg" @click="start">{{ startLabel }}</button>
        <a class="btn btn--ghost btn--lg" href="#pilot">Стать пилотной командой →</a>
      </div>
      <LandingDemoSlider />
    </div>
  </section>
</template>

<style scoped>
.hero { padding: 72px 0 0; text-align: center; }
.hero__chip {
  display: inline-flex;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--orange-soft);
  color: var(--orange);
  font-size: 13px;
}
.hero__h1 {
  margin: 26px auto 0;
  font-size: clamp(40px, 5.6vw, 76px);
  line-height: 1.03;
  letter-spacing: -0.035em;
}
.hero__h1 em { font-style: normal; color: var(--orange); }
.hero__sub { margin: 22px auto 0; max-width: 46ch; font-size: 19px; }
.hero__cta { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 34px; }

@media (max-width: 900px) {
  .hero__br { display: none; }
}
@media (max-width: 640px) {
  .hero { padding-top: 48px; }
  .hero__sub { font-size: 17px; }
}
</style>
