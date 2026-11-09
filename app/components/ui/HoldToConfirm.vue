<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  duration?: number
  disabled?: boolean
  disabledHint?: string
  loading?: boolean
}>(), { duration: 2000, disabled: false, disabledHint: undefined, loading: false })

const emit = defineEmits<{ confirm: [] }>()

const progress = ref(0)
let startedAt = 0
let frame = 0

function tick(now: number) {
  progress.value = holdProgress(now - startedAt, props.duration)
  if (progress.value >= 1) {
    stop()
    emit('confirm')
    return
  }
  frame = requestAnimationFrame(tick)
}

function start() {
  if (props.disabled || props.loading || frame) return
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

function cancel() {
  stop()
  progress.value = 0
}

function onKey(e: KeyboardEvent) {
  if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault()
  start()
}

onBeforeUnmount(stop)
</script>

<template>
  <button
    type="button"
    class="relative w-full select-none overflow-hidden rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
    :class="disabled
      ? 'cursor-not-allowed border border-dashed border-accented bg-elevated/60 text-muted'
      : 'border border-error bg-error text-white shadow-sm hover:brightness-110 active:scale-[0.99]'"
    :disabled="disabled || loading"
    :aria-label="`${label}. Удерживайте ${duration / 1000} с`"
    @pointerdown="start"
    @pointerup="cancel"
    @pointerleave="cancel"
    @pointercancel="cancel"
    @keydown="onKey"
    @keyup="cancel"
    @blur="cancel"
  >
    <span class="absolute inset-y-0 left-0 bg-white/30" :style="{ width: `${progress * 100}%` }" />
    <span class="relative inline-flex items-center gap-2">
      <UIcon v-if="loading" name="i-hugeicons-loading-03" class="size-4 animate-spin" />
      <UIcon v-else-if="disabled" name="i-hugeicons-lock-password" class="size-4" />
      <UIcon v-else name="i-hugeicons-delete-02" class="size-4" />
      {{ disabled && disabledHint ? disabledHint : label }}
    </span>
  </button>
</template>
