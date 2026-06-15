<script setup lang="ts">
const goToApp = useAccessCta()
const dense = ref(false)

const links: Array<[string, string]> = [
  ['Что работает', '#what'],
  ['Почему мы', '#why'],
  ['Roadmap', '#roadmap'],
  ['О проекте', '#about'],
]

function onScroll() {
  dense.value = window.scrollY > 40
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <nav class="nav" :class="{ dense }">
    <div class="nav__bar">
      <a class="nav__logo" href="#top">
        <b>Scrum<span>Ban</span></b>
      </a>
      <span class="nav__div" />
      <div class="nav__links">
        <a v-for="[label, href] in links" :key="label + href" class="nav__link" :href="href">{{ label }}</a>
      </div>
      <button class="nav__cta" @click="goToApp">
        Ранний доступ
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </button>
    </div>
  </nav>
</template>