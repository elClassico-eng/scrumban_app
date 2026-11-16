<script setup lang="ts">
// Splits on regular spaces only, so words glued with a no-break space animate as one.
const props = withDefaults(defineProps<{ text: string, start?: number }>(), { start: 0 })
const words = computed(() => props.text.split(' '))
</script>

<template>
  <template v-for="(w, i) in words" :key="i">
    <span class="sw" :style="{ '--i': start + i }">{{ w }}</span>{{ i < words.length - 1 ? ' ' : '' }}
  </template>
</template>
