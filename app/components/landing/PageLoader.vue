<script setup lang="ts">
const SEEN_KEY = 'takt:landing-seen'

// Runs before first paint, so a repeat visit in the same tab session
// never flashes the loader over the already-prerendered page.
useHead({
  script: [{
    key: 'landing-loader-seen',
    innerHTML: `try{if(sessionStorage.getItem('${SEEN_KEY}'))document.documentElement.classList.add('takt-seen')}catch(e){}`,
    tagPosition: 'head',
  }],
})

const shown = ref(true)

const FONTS_WAIT_MS = 1500

onMounted(async () => {
  await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, FONTS_WAIT_MS))])
  shown.value = false
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  }
  catch {
    // storage blocked: the loader simply shows again next time
  }
})
</script>

<template>
  <Transition name="lloader">
    <div v-if="shown" class="lloader" aria-hidden="true">
      <TaktLoader />
    </div>
  </Transition>
</template>

<style scoped>
/* The opacity animation makes this a stacking context, so it must carry the z-index itself.
   Safety net: if hydration fails, the overlay still fades out on its own. */
.lloader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  animation: lloader-auto-out 0.4s ease 2.5s forwards;
}
@keyframes lloader-auto-out { to { opacity: 0; visibility: hidden; } }

.lloader-leave-active { transition: opacity 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
.lloader-leave-to { opacity: 0; }

:global(html.takt-seen) .lloader { display: none; }

@media (prefers-reduced-motion: reduce) {
  .lloader { display: none; }
}
</style>
