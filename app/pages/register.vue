<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Регистрация — Scrumban' })

const authStore = useAuthStore()

watchEffect(() => {
  if (authStore.isAuthenticated) {
    navigateTo(pageRoutes.workspaces)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="text-center space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">Создать аккаунт</h1>
      <p class="text-sm text-muted">Начни управлять задачами команды</p>
    </div>
    <AuthRegisterForm />
    <p class="text-sm text-muted text-center">
      Уже есть аккаунт?
      <NuxtLink :to="pageRoutes.login" class="text-primary hover:underline">
        Войти
      </NuxtLink>
    </p>
  </div>
</template>