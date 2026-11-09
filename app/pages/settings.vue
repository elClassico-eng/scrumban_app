<script setup lang="ts">
useHead({ title: 'Настройки – Такт' })
</script>

<template>
  <div class="space-y-4 py-2">
    <UiPageHeader title="Настройки" subtitle="Ты и твои воркспейсы" />

    <div class="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3 lg:sticky lg:top-6">
        <SettingsNav />
      </div>

      <div class="lg:col-span-9">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>
