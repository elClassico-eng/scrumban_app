<script setup lang="ts">
import { ru } from '@nuxt/ui/locale'

const online = useOnline()
</script>

<template>
  <UApp :locale="ru">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <CommonConfirmDialog />
    <ClientOnly>
      <TaktLoader v-if="!online" label="Переподключение…" />
    </ClientOnly>
  </UApp>
</template>