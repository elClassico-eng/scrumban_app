<script setup lang="ts">
import { sidebarFade } from '~/utils/sidebar-items'

defineProps<{ label: string; collapsed: boolean }>()
</script>

<template>
  <div class="relative flex h-9 shrink-0 items-end px-3 pb-1.5">
    <span
      :class="['absolute left-5 top-1/2 h-px w-4 -translate-x-1/2 bg-[var(--ui-border-accented)] transition-opacity duration-200', collapsed ? 'opacity-100' : 'opacity-0']"
    />
    <p :class="['text-[11px] font-semibold uppercase tracking-wider text-dimmed', sidebarFade(collapsed)]">
      {{ label }}
    </p>
  </div>
</template>
