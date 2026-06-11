<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: string
  accent?: boolean
}>()
</script>

<template>
  <div
    class="rounded-2xl p-[13px] flex flex-col gap-[6px]"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)]">{{ label }}</div>
    <div
      class="flex items-center gap-[5px] text-[13px] font-semibold"
      :style="accent ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'"
    >
      <UIcon :name="icon" class="w-[13px] h-[13px] shrink-0" />
      <span>{{ value }}</span>
    </div>
  </div>
</template>
