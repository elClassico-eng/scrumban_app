<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: string
  accent?: boolean
  clickable?: boolean
  info?: { answers: string, formula?: string, action?: string }
}>()

defineEmits<{
  click: [e: Event]
}>()
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="rounded-2xl p-[13px] flex flex-col gap-[6px] text-left transition-colors"
    :class="clickable ? 'cursor-pointer hover:bg-[var(--island-hover)]' : ''"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
    @click="clickable && $emit('click', $event)"
  >
    <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)]">
      {{ label }}
      <UIcon v-if="clickable" name="i-lucide-check-circle" class="w-3 h-3" />
      <AnalyticsInfo v-if="info && !clickable" :answers="info.answers" :formula="info.formula" :action="info.action" />
    </div>
    <div
      class="flex items-center gap-[5px] text-[13px] font-semibold"
      :style="accent ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'"
    >
      <UIcon :name="icon" class="w-[13px] h-[13px] shrink-0" />
      <span>{{ value }}</span>
    </div>
  </component>
</template>
