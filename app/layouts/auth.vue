<template>
  <div class="min-h-screen flex flex-col lg:flex-row">
    <div class="relative hidden lg:flex flex-1 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-200 via-violet-200 to-sky-200 dark:from-pink-900/30 dark:via-violet-900/30 dark:to-sky-900/30" />
      <div class="absolute -top-24 -left-24 size-96 rounded-full bg-pink-300/60 dark:bg-pink-500/20 blur-3xl" />
      <div class="absolute top-1/3 right-10 size-80 rounded-full bg-violet-300/50 dark:bg-violet-500/20 blur-3xl" />
      <div class="absolute -bottom-20 left-1/4 size-96 rounded-full bg-sky-300/60 dark:bg-sky-500/20 blur-3xl" />
      <div class="relative z-10 flex flex-col justify-between p-12 w-full">
        <div class="flex items-center gap-2 text-default">
          <UIcon name="i-lucide-layout-dashboard" class="size-7 text-primary" />
          <span class="font-bold tracking-tight text-xl">Scrumban</span>
        </div>

        <div class="space-y-8 max-w-md">
          <div class="space-y-3">
            <h2 class="text-4xl font-bold tracking-tight text-default leading-tight">
              Поток работы — под контролем
            </h2>
            <p class="text-base text-muted leading-relaxed">
              Гибрид Kanban и Scrum с глубокой аналитикой потока: классы
              обслуживания, SLE, Aging WIP, прогноз Monte Carlo.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
      <div class="glass-strong w-full max-w-md rounded-3xl p-10">
        <slot />
      </div>
    </div>
  </div>
</template>