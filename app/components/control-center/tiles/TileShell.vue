<script setup lang="ts">
defineProps<{
  label: string
  clickable?: boolean
  accent?: boolean
}>()

defineEmits<{
  click: [e: Event]
}>()
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="rounded-2xl p-[13px] flex flex-col gap-[6px] text-left transition-colors min-h-[104px]"
    :class="clickable ? 'cursor-pointer hover:bg-[var(--island-hover)]' : ''"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
    @click="clickable && $emit('click', $event)"
  >
    <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)]">
      {{ label }}
      <UIcon v-if="clickable" name="i-lucide-arrow-up-right" class="w-3 h-3 ml-auto" />
    </div>
    <slot />
  </component>
</template>
