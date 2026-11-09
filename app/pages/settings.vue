<script setup lang="ts">
useHead({ title: 'Настройки – Такт' })
</script>

<template>
  <div class="space-y-5 py-2">
    <UiPageHeader title="Настройки" subtitle="Ты и твои воркспейсы" />
    <SettingsScopeBar />
    <NuxtPage />
  </div>
</template>
