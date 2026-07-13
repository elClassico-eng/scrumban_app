<script setup lang="ts">
defineProps<{ src: string, alt: string }>()

const open = ref(false)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})

watch(open, (v) => {
  document.documentElement.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <button type="button" class="shotbtn" :aria-label="`Увеличить: ${alt}`" @click="open = true">
    <img class="shot" :src="src" :alt="alt" loading="lazy">
    <span class="shotbtn__zoom" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
    </span>
  </button>
  <Teleport to="body">
    <div v-if="open" class="landing-lightbox" role="dialog" aria-modal="true" @click="open = false">
      <img :src="src" :alt="alt">
      <button type="button" class="landing-lightbox__close" aria-label="Закрыть" @click.stop="open = false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  </Teleport>
</template>
