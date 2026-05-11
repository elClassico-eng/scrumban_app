<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Войти — Scrumban' })

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
      <h1 class="text-2xl font-bold tracking-tight">С возвращением</h1>
      <p class="text-sm text-muted">Войди, чтобы открыть свои доски</p>
    </div>
    <AuthLoginForm />
    <p class="text-sm text-muted text-center">
      Нет аккаунта?
      <NuxtLink :to="pageRoutes.register" class="text-primary hover:underline">
        Зарегистрироваться
      </NuxtLink>
    </p>
  </div>
</template>