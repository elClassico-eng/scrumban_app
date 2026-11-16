<script setup lang="ts">
import type { UploadItem } from '~/composables/useFileUploader'

defineProps<{ items: UploadItem[] }>()
const emit = defineEmits<{ dismiss: [id: string] }>()
</script>

<template>
  <div v-if="items.length" class="flex flex-wrap gap-2">
    <div v-for="i in items" :key="i.id" class="flex w-56 items-center gap-2 rounded-xl bg-elevated/60 px-3 py-2">
      <UIcon
        :name="i.status === 'error' ? 'i-hugeicons-alert-circle' : i.status === 'done' ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-upload-01'"
        class="size-4 shrink-0"
        :class="i.status === 'error' ? 'text-error' : i.status === 'done' ? 'text-success' : 'text-muted'"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-default">{{ i.name }}</p>
        <p v-if="i.error" class="truncate text-[11px] text-error">{{ i.error }}</p>
        <div v-else-if="i.status === 'uploading'" class="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-accent-500 transition-all" :style="{ width: `${i.progress * 100}%` }" />
        </div>
      </div>
      <button
        v-if="i.status !== 'uploading'"
        type="button"
        class="cursor-pointer text-muted hover:text-default"
        aria-label="Убрать"
        @click="emit('dismiss', i.id)"
      >
        <UIcon name="i-hugeicons-cancel-01" class="size-4" />
      </button>
    </div>
  </div>
</template>
