<script setup lang="ts">
const props = defineProps<{ disabled?: boolean, pasteTarget?: 'window' | 'self' }>()
const emit = defineEmits<{ files: [files: File[]] }>()
const root = ref<HTMLElement | null>(null)
const over = ref(false)

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function onPaste(e: Event) {
  const ev = e as ClipboardEvent
  if (props.disabled) return
  if (props.pasteTarget !== 'self' && isTyping(ev.target)) return
  const files = [...(ev.clipboardData?.files ?? [])]
  if (!files.length) return
  ev.preventDefault()
  emit('files', files)
}

function onDragOver(e: DragEvent) {
  if (props.disabled || !e.dataTransfer?.types.includes('Files')) return
  over.value = true
}

function onDrop(e: DragEvent) {
  over.value = false
  if (props.disabled) return
  const files = [...(e.dataTransfer?.files ?? [])]
  if (files.length) emit('files', files)
}

function pasteHost(): EventTarget | null {
  return props.pasteTarget === 'self' ? root.value : window
}

onMounted(() => pasteHost()?.addEventListener('paste', onPaste))
onBeforeUnmount(() => pasteHost()?.removeEventListener('paste', onPaste))
</script>

<template>
  <div
    ref="root"
    class="relative"
    @dragover.prevent="onDragOver"
    @dragleave.self="over = false"
    @drop.prevent="onDrop"
  >
    <slot />
    <div
      v-if="over"
      class="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent-500 bg-accent-500/5"
    >
      <p class="text-sm font-medium text-accent-600">Отпустите, чтобы прикрепить</p>
    </div>
  </div>
</template>
