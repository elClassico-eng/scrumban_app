<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const online = useOnline()
const PHRASES = ['Собираем доску…', 'Считаем прогноз…', 'Ловим ритм…', 'Зовём команду…']

// ponytail: the splash is shown by an inline head script (html.takt-returning)
// before hydration, and dropped once the first real page has rendered.
useNuxtApp().hook('page:finish', () => {
  document.documentElement.classList.remove('takt-returning')
})
</script>

<template>
  <UApp :locale="ru">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <CommonConfirmDialog />
    <TaktLoader class="takt-splash" :phrases="PHRASES" />
    <ClientOnly>
      <TaktLoader v-if="!online" label="Переподключение…" />
    </ClientOnly>
  </UApp>
</template>

<style>
.takt-splash {
  transition: transform 0.7s cubic-bezier(0.76, 0, 0.24, 1), visibility 0.7s;
}
.takt-splash .takt-loader__inner {
  transition: opacity 0.3s ease, transform 0.5s cubic-bezier(0.76, 0, 0.24, 1);
}
html:not(.takt-returning) .takt-splash {
  transform: translateY(-100%);
  visibility: hidden;
  pointer-events: none;
}
html:not(.takt-returning) .takt-splash .takt-loader__inner {
  opacity: 0;
  transform: translateY(-40px);
}
</style>
