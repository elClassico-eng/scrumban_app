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

onMounted(async () => {
  await document.fonts?.ready
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
.lloader-leave-active { transition: opacity 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
.lloader-leave-to { opacity: 0; }

:global(html.takt-seen) .lloader { display: none; }

@media (prefers-reduced-motion: reduce) {
  .lloader { display: none; }
}
</style>
