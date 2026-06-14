<script setup lang="ts">
withDefaults(defineProps<{
  to: string
  icon: string
  label: string
  collapsed: boolean
  exact?: boolean
}>(), { exact: false })
</script>

<template>
  <UTooltip :text="label" :disabled="!collapsed" :popper="{ placement: 'right' }">
    <NuxtLink v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
      <a
        :href="href"
        :aria-current="(exact ? isExactActive : isActive) ? 'page' : undefined"
        :class="[
          'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          (exact ? isExactActive : isActive)
            ? (collapsed
              ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
              : 'bg-accent-50 text-accent-700 font-semibold shadow-sm ring-1 ring-accent-500/10 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/20')
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
        @click="navigate"
      >
        <span
          v-if="(exact ? isExactActive : isActive) && !collapsed"
          class="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent-500"
        />
        <UIcon :name="icon" class="size-4 shrink-0" />
        <span v-if="!collapsed" class="truncate">{{ label }}</span>
      </a>
    </NuxtLink>
  </UTooltip>
</template>
