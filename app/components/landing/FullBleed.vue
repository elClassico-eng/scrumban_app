<script setup lang="ts">
import { FULL_BLEED } from '~/utils/landing-content'
</script>

<template>
  <section class="bleed" :style="{ '--bleed-image': `url(${FULL_BLEED.image})` }">
    <div class="bleed__in reveal">
      <h2>{{ FULL_BLEED.title }}</h2>
      <p>{{ FULL_BLEED.text }}</p>
      <a v-if="FULL_BLEED.cta" class="btn btn--lg bleed__cta" :href="FULL_BLEED.cta.to">{{ FULL_BLEED.cta.label }}</a>
    </div>
  </section>
</template>

<style scoped>
.bleed {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin-top: 96px;
  overflow: hidden;
  color: #fff;
  text-align: center;
}
/* The gradient image has a ~2% light frame baked in (made for the auth card), so overscan to crop it. */
.bleed::before {
  content: "";
  position: absolute;
  inset: -6%;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.45)), var(--bleed-image) center / cover no-repeat;
}
.bleed__in { position: relative; max-width: 860px; padding: 0 var(--gut); }
.bleed h2 { font-size: clamp(44px, 7vw, 88px); line-height: 1; max-width: none; }
.bleed p { margin-top: 18px; font-size: 19px; color: rgba(255, 255, 255, 0.82); }
.bleed__cta { margin-top: 28px; background: #fff; color: var(--ink); }
</style>
