<script setup lang="ts">
const goToApp = useAccessCta()
const dense = ref(false)
const open = ref(false)

const links: Array<[string, string]> = [
  ['Почему Такт', '#why'],
  ['Продукт', '#product'],
  ['Roadmap', '#roadmap'],
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
  <nav class="pnav" :class="{ dense, open }">
    <div class="pnav__pill">
      <a class="pnav__logo" href="#top">
        <TaktMark class="pnav__mark" />
        <b>Такт<i>*</i></b>
      </a>
      <div class="pnav__links">
        <a v-for="[label, href] in links" :key="href" :href="href" @click="open = false">{{ label }}</a>
        <NuxtLink to="/docs" external>Документация</NuxtLink>
      </div>
      <button class="btn btn--dark pnav__cta" @click="goToApp">Ранний доступ</button>
      <button class="pnav__burger" aria-label="Меню" :aria-expanded="open" @click="open = !open">
        <span /><span />
      </button>
    </div>
    <div v-if="open" class="pnav__sheet">
      <a v-for="[label, href] in links" :key="href" :href="href" @click="open = false">{{ label }}</a>
      <NuxtLink to="/docs" external>Документация</NuxtLink>
      <button class="btn btn--dark" @click="goToApp">Ранний доступ</button>
    </div>
  </nav>
</template>
