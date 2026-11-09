<script setup lang="ts">
useHead({ title: 'Настройки – Такт' })
</script>

<template>
  <div class="space-y-5 py-2">
    <UiPageHeader title="Настройки" subtitle="Ваш профиль и ваши воркспейсы" />
    <div class="pb-2">
      <SettingsScopeBar />
    </div>
    <NuxtPage />
  </div>
</template>
