<script setup lang="ts">
withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })
const LOGO_URL = '/integrations/pachca.svg'
const failed = ref(false)
</script>

<template>
  <span
    class="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-default"
    :class="size === 'lg' ? 'size-14' : 'size-10'"
  >
    <img v-if="!failed" :src="LOGO_URL" alt="Пачка" class="size-full object-contain p-1.5" @error="failed = true">
    <span v-else class="font-bold text-neutral-700" :class="size === 'lg' ? 'text-xl' : 'text-base'">П</span>
  </span>
</template>
