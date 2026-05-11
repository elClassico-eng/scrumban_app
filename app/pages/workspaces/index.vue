<script setup lang="ts">
useHead({ title: 'Воркспейсы — Scrumban' })
const authStore = useAuthStore()
</script>

<template>
  <div class="space-y-4 max-w-2xl">
    <h1 class="text-2xl font-bold tracking-tight">Воркспейсы</h1>
    <p class="text-muted">
      Здесь появится список воркспейсов в Step 2. Сейчас — только проверка auth flow.
    </p>
    <UCard>
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-shield-check" class="text-success size-5" />
        <div class="text-sm">
          Ты авторизован как <strong>{{ authStore.user?.email ?? '—' }}</strong>.
        </div>
      </div>
    </UCard>
  </div>
</template>