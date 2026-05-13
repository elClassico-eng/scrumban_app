<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Войти — Scrumban' })
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">С возвращением</h1>
      <p class="text-sm text-muted leading-relaxed">
        Войдите, чтобы открыть свои доски и команды.
      </p>
    </div>
    <AuthLoginForm />
    <p class="text-sm text-muted text-center">
      Нет аккаунта?
      <NuxtLink :to="pageRoutes.register" class="text-primary font-medium hover:underline">
        Зарегистрироваться
      </NuxtLink>
    </p>
  </div>
</template>