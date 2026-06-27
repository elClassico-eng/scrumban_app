<script setup lang="ts">
const route = useRoute()
const cardMaxWidth = computed(() => (route.meta.cardMaxWidth as string | undefined) ?? 'lg:max-w-md')
</script>

<template>
  <div class="min-h-dvh brand-gradient relative flex flex-col lg:flex-row overflow-hidden">
    <div class="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-32 right-10 size-[28rem] rounded-full bg-black/30 blur-3xl" />

    <div class="relative z-10 hidden lg:flex flex-1 flex-col justify-between p-12 text-white">
      <NuxtLink to="/" class="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity">
        <TaktMark class="size-7" />
        <span class="font-bold tracking-tight text-xl">Такт</span>
      </NuxtLink>

      <div class="space-y-8 max-w-md">
        <div class="space-y-3">
          <h2 class="text-4xl font-bold tracking-tight leading-tight">
            Поток работы — под контролем
          </h2>
          <p class="text-base text-white/80 leading-relaxed">
            Гибрид Kanban и Scrum с глубокой аналитикой потока: классы
            обслуживания, SLE, Aging WIP, прогноз Monte Carlo.
          </p>
        </div>
      </div>
    </div>

    <div class="relative z-10 flex-1 flex lg:items-center lg:justify-center lg:p-12">
      <div :class="['w-full bg-default p-6 sm:p-10 flex-1 lg:flex-none lg:rounded-3xl lg:shadow-xl lg:shadow-black/20', cardMaxWidth]">
        <NuxtLink to="/" class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-default mb-6 transition-colors">
          <UIcon name="i-lucide-arrow-left" class="size-4" /> На главную
        </NuxtLink>
        <slot />
      </div>
    </div>
  </div>
</template>
