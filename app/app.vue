<script setup lang="ts">
const online = useOnline()
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <CommonConfirmDialog />
    <ClientOnly>
      <TaktLoader v-if="!online" label="Переподключение…" />
    </ClientOnly>
  </UApp>
</template>