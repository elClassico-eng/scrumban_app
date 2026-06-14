<script setup lang="ts">
defineProps<{
  answers: string
  formula?: string
  note?: string
}>()
</script>

<template>
  <UPopover>
    <button
      type="button"
      class="size-5 grid place-items-center rounded-full text-dimmed hover:text-default hover:bg-elevated transition-colors cursor-pointer shrink-0"
      aria-label="Как это считается"
    >
      <UIcon name="i-lucide-info" class="size-3.5" />
    </button>
    <template #content>
      <div class="p-3 space-y-2 max-w-[260px]">
        <p class="text-sm text-default leading-snug">{{ answers }}</p>
        <p v-if="formula" class="font-mono text-[11.5px] text-muted bg-elevated rounded-md px-2 py-1.5 leading-relaxed">{{ formula }}</p>
        <p v-if="note" class="text-xs text-dimmed leading-snug">{{ note }}</p>
      </div>
    </template>
  </UPopover>
</template>
