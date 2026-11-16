<script setup lang="ts">
import type { FileView } from '#shared/types/files'
import type { UploadItem } from '~/composables/useFileUploader'

const props = defineProps<{
  files: FileView[]
  uploads: UploadItem[]
  canUpload: boolean
}>()
const emit = defineEmits<{ add: [files: File[]], remove: [file: FileView], dismiss: [id: string] }>()
const input = ref<HTMLInputElement | null>(null)

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  emit('add', [...(el.files ?? [])])
  el.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="props.canUpload" class="flex flex-wrap items-center gap-3">
      <UButton size="sm" icon="i-hugeicons-attachment-01" @click="input?.click()">Прикрепить</UButton>
      <p class="text-xs text-muted">Или перетащите файлы на задачу, или вставьте скриншот Ctrl+V. До 25 МБ.</p>
      <input ref="input" type="file" multiple class="hidden" @change="onPick">
    </div>
    <FilesUploadTiles :items="uploads" @dismiss="emit('dismiss', $event)" />
    <FilesAttachmentList v-if="files.length" :files="files" @remove="emit('remove', $event)" />
    <p v-else-if="!uploads.length" class="text-sm text-muted">Файлов пока нет.</p>
  </div>
</template>
