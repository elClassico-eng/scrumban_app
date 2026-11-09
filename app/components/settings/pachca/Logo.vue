<script setup lang="ts">
withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })
const LOGO_URL = '/integrations/pachca.svg'
const failed = ref(false)
</script>

<template>
  <span class="grid shrink-0 place-items-center" :class="size === 'lg' ? 'size-14' : 'size-10'">
    <img v-if="!failed" :src="LOGO_URL" alt="Пачка" class="size-full" @error="failed = true">
    <span v-else class="grid size-full place-items-center rounded-full bg-neutral-900 font-bold text-white" :class="size === 'lg' ? 'text-xl' : 'text-base'">П</span>
  </span>
</template>
