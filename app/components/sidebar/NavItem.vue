<script setup lang="ts">
import { Motion } from 'motion-v'
import { SIDEBAR_SPRING } from '~/utils/sidebar-items'

withDefaults(defineProps<{
  to: string
  icon: string
  label: string
  collapsed: boolean
  exact?: boolean
  external?: boolean
}>(), { exact: false, external: false })
</script>

<template>
  <UTooltip :text="label" :disabled="!collapsed" :content="{ side: 'right' }">
    <a
      v-if="external"
      :href="to"
      target="_blank"
      rel="noopener"
      :class="[
        'flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
        'text-muted hover:bg-elevated hover:text-default',
      ]"
    >
      <UIcon :name="icon" class="size-4 shrink-0" />
      <span v-if="!collapsed" class="truncate">{{ label }}</span>
      <UIcon v-if="!collapsed" name="i-hugeicons-arrow-up-right-01" class="ml-auto size-3.5 opacity-60" />
    </a>
    <NuxtLink v-else v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
      <a
        :href="href"
        :aria-current="(exact ? isExactActive : isActive) ? 'page' : undefined"
        :class="[
          'relative flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          (exact ? isExactActive : isActive)
            ? 'text-highlighted font-semibold'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
        @click="navigate"
      >
        <Motion
          v-if="exact ? isExactActive : isActive"
          layout-id="sidebar-active"
          class="absolute inset-0 rounded-xl bg-accented"
          :transition="SIDEBAR_SPRING"
        />
        <UIcon :name="icon" class="relative size-4 shrink-0" />
        <span v-if="!collapsed" class="relative truncate">{{ label }}</span>
      </a>
    </NuxtLink>
  </UTooltip>
</template>
