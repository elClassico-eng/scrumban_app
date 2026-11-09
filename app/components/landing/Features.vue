<script setup lang="ts">
import { FEATURES_BIG, FEATURES_SMALL } from '~/utils/landing-content'

const bento = ref<HTMLElement | null>(null)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  bento.value?.querySelectorAll('video').forEach(v => v.play().catch(() => {}))
})
</script>

<template>
  <section id="features" class="section">
    <div class="wrap">
      <LandingSectionHead :n="3" label="возможности" title="Всё, что нужно потоку. И ничего лишнего">
        <a class="btn btn--dark" href="/docs">Все возможности</a>
      </LandingSectionHead>
      <div ref="bento" class="bento">
        <article v-for="f in FEATURES_BIG" :key="f.title" class="bento__big reveal">
          <div class="bento__media">
            <video v-if="f.video" :poster="f.poster" muted loop playsinline preload="none">
              <source :src="`${f.video}.webm`" type="video/webm">
              <source :src="`${f.video}.mp4`" type="video/mp4">
            </video>
            <img v-else :src="f.poster" :alt="f.title" loading="lazy">
          </div>
          <div class="bento__text">
            <h3>{{ f.title }}</h3>
            <p class="muted">{{ f.text }}</p>
          </div>
        </article>
        <article v-for="f in FEATURES_SMALL" :key="f.title" class="card bento__small reveal">
          <span class="bento__ico"><UIcon :name="f.icon!" /></span>
          <h3>{{ f.title }}</h3>
          <p class="muted">{{ f.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.bento__big { grid-column: span 2; border-radius: 22px; background: var(--soft); overflow: hidden; display: flex; flex-direction: column; }
.bento__media { height: 260px; overflow: hidden; }
.bento__media :is(img, video) { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
.bento__text { padding: 24px 28px 28px; }
.bento__big h3 { font-size: 21px; margin-bottom: 6px; }
.bento__small { padding: 24px; }
.bento__ico { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--orange-soft); color: var(--orange); font-size: 22px; }
.bento__small h3 { font-size: 18px; margin: 22px 0 6px; }
.bento__small p { font-size: 14.5px; }

@media (max-width: 900px) {
  .bento { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .bento { grid-template-columns: 1fr; }
  .bento__big { grid-column: auto; }
  .bento__media { height: 200px; }
}
</style>
