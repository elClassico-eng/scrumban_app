<script setup lang="ts">
import type { FileView } from '#shared/types/files'

const props = defineProps<{ files: FileView[], compact?: boolean }>()
const emit = defineEmits<{ remove: [file: FileView] }>()
const images = computed(() => props.files.filter(f => f.thumbUrl || isPreviewableImage(f.contentType)))
const others = computed(() => props.files.filter(f => !images.value.includes(f)))
const viewerIndex = ref<number | null>(null)
const confirming = ref<FileView | null>(null)

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function confirmRemove() {
  if (confirming.value) emit('remove', confirming.value)
  confirming.value = null
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="images.length"
      class="grid gap-2"
      :class="compact ? 'grid-cols-[repeat(auto-fill,minmax(88px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))]'"
    >
      <div v-for="(f, i) in images" :key="f.id" class="group relative aspect-square overflow-hidden rounded-xl bg-elevated">
        <button type="button" class="size-full cursor-zoom-in" :aria-label="f.name" @click="viewerIndex = i">
          <img :src="f.thumbUrl ?? f.url" :alt="f.name" loading="lazy" decoding="async" class="size-full object-cover">
        </button>
        <button
          v-if="f.canDelete"
          type="button"
          class="absolute right-1 top-1 hidden cursor-pointer rounded-md bg-black/60 p-1 text-white group-hover:block"
          aria-label="Удалить"
          @click="confirming = f"
        >
          <UIcon name="i-hugeicons-delete-02" class="size-3.5" />
        </button>
      </div>
    </div>

    <ul v-if="others.length" class="divide-y divide-default rounded-xl bg-elevated/40">
      <li v-for="f in others" :key="f.id" class="flex items-center gap-3 px-3 py-2">
        <UIcon :name="fileIcon(f.contentType)" class="size-5 shrink-0 text-muted" />
        <div class="min-w-0 flex-1">
          <a :href="f.url" target="_blank" rel="noopener" class="block truncate text-sm text-default hover:underline">{{ f.name }}</a>
          <p class="text-[11.5px] text-muted">
            {{ formatBytes(f.sizeBytes) }}<template v-if="!compact"> · {{ f.uploadedBy?.name }} · {{ when(f.createdAt) }}</template>
          </p>
        </div>
        <UButton :to="f.downloadUrl" external size="xs" color="neutral" variant="ghost" icon="i-hugeicons-download-01" aria-label="Скачать" />
        <UButton v-if="f.canDelete" size="xs" color="neutral" variant="ghost" icon="i-hugeicons-delete-02" aria-label="Удалить" @click="confirming = f" />
      </li>
    </ul>

    <FilesImageViewer v-model:index="viewerIndex" :images="images" />

    <UModal :open="!!confirming" title="Удалить файл?" @update:open="(v: boolean) => { if (!v) confirming = null }">
      <template #body>
        <p class="text-sm text-muted">«{{ confirming?.name }}» удалится у всех участников.</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirming = null">Отмена</UButton>
          <UButton color="error" @click="confirmRemove">Удалить</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
