<script setup lang="ts">
const props = defineProps<{ text: string }>()
const id = useId()
</script>

<template>
  <span class="sbadge">
    <svg viewBox="0 0 100 100" class="sbadge__ring" aria-hidden="true">
      <defs>
        <path :id="`sb-${id}`" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      <text>
        <textPath :href="`#sb-${id}`">{{ props.text }}</textPath>
      </text>
    </svg>
    <span class="sbadge__center"><TaktMark /></span>
  </span>
</template>
