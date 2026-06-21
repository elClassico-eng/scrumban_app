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
          'flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          (exact ? isExactActive : isActive)
            ? 'bg-accent-500/10 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
        @click="navigate"
      >
        <UIcon :name="icon" class="size-4 shrink-0" />
        <span v-if="!collapsed" class="truncate">{{ label }}</span>
      </a>
    </NuxtLink>
  </UTooltip>
</template>
