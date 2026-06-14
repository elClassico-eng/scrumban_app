<script setup lang="ts">
defineProps<{
  time: string
  weekday: string
  timerTaskId: string
  seconds: number
  running: boolean
  active: boolean
  unread: number
  expanded: boolean
}>()

defineEmits<{
  bell: []
}>()
</script>

<template>
  <div class="flex items-baseline gap-[7px] whitespace-nowrap">
    <b class="text-[15px] font-semibold tracking-[-0.01em]">{{ time }}</b>
    <template v-if="expanded">
      <span class="text-[var(--island-ink-3)]">·</span>
      <span class="text-[13px] text-[var(--island-ink-3)]">{{ weekday }}</span>
    </template>
  </div>
  <div class="flex-1" />
  <div
    v-if="expanded && active"
    class="inline-flex items-center gap-2 h-8 px-3 rounded-full text-[var(--island-orange-2)] text-[12.5px] font-semibold whitespace-nowrap max-w-[220px] overflow-hidden"
    style="background: var(--island-orange-tint); border: 1px solid var(--island-orange-tint-border);"
  >
    <span
      class="w-[7px] h-[7px] rounded-full flex-shrink-0"
      :class="running ? 'bg-[var(--island-orange)] cc-pulse-dot' : 'bg-[var(--island-ink-3)]'"
    />
    <span class="font-mono text-[var(--island-ink-2)] font-medium">{{ timerTaskId }}</span>
    <span class="font-mono">{{ formatClock(seconds) }}</span>
  </div>
  <button
    class="relative w-9 h-9 rounded-full grid place-items-center border-none cursor-pointer text-[var(--island-ink-2)] hover:text-[var(--island-ink)] transition-colors"
    style="background: var(--island-fill);"
    title="Уведомления"
    aria-label="Уведомления"
    @click.stop="$emit('bell')"
  >
    <UIcon name="i-lucide-bell" class="w-[18px] h-[18px]" />
    <span
      v-if="unread > 0"
      class="absolute -top-[1px] -right-[1px] min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--island-orange)] text-white text-[9.5px] font-bold grid place-items-center"
      style="border: 2px solid var(--island-bg);"
    >{{ unread > 9 ? '9+' : unread }}</span>
  </button>
  <UIcon
    v-if="expanded"
    name="i-lucide-chevron-down"
    class="w-4 h-4 text-[var(--island-ink-3)] shrink-0 ml-0.5"
  />
</template>
