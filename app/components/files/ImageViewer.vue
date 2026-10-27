<script setup lang="ts">
import type { FileView } from '#shared/types/files'

const props = defineProps<{ images: FileView[] }>()
const index = defineModel<number | null>('index', { default: null })
const current = computed(() => (index.value === null ? null : props.images[index.value] ?? null))

function step(delta: number) {
  if (index.value === null || !props.images.length) return
  index.value = (index.value + delta + props.images.length) % props.images.length
}

onKeyStroke('ArrowLeft', () => step(-1))
onKeyStroke('ArrowRight', () => step(1))
</script>

<template>
  <UModal :open="!!current" fullscreen :ui="{ content: 'bg-black/90' }" @update:open="(v: boolean) => { if (!v) index = null }">
    <template #content>
      <div v-if="current" class="relative grid h-full place-items-center p-6">
        <img :src="current.url" :alt="current.name" class="max-h-full max-w-full object-contain">
        <div class="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white">
          <span class="truncate text-sm">{{ current.name }}</span>
          <div class="flex gap-2">
            <UButton :to="current.downloadUrl" external icon="i-hugeicons-download-01" color="neutral" variant="soft" aria-label="Скачать" />
            <UButton icon="i-hugeicons-cancel-01" color="neutral" variant="soft" aria-label="Закрыть" @click="index = null" />
          </div>
        </div>
        <UButton v-if="images.length > 1" class="absolute left-4" icon="i-hugeicons-arrow-left-01" color="neutral" variant="soft" aria-label="Назад" @click="step(-1)" />
        <UButton v-if="images.length > 1" class="absolute right-4" icon="i-hugeicons-arrow-right-01" color="neutral" variant="soft" aria-label="Дальше" @click="step(1)" />
      </div>
    </template>
  </UModal>
</template>
