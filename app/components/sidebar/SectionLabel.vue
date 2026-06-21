<script setup lang="ts">
defineProps<{ label: string; collapsed: boolean }>()
</script>

<template>
  <div v-if="collapsed" class="mx-2 my-2.5 border-t border-default" />
  <p v-else class="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
    {{ label }}
  </p>
</template>
