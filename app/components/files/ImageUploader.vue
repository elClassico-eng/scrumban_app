<script setup lang="ts">
import type { UploadTarget } from '~/composables/useFileUploader'

const props = defineProps<{
  target: UploadTarget
  currentUrl: string | null
  fallback: string
  shape?: 'circle' | 'rounded'
  remove?: (() => Promise<unknown>) | null
}>()
const emit = defineEmits<{ changed: [] }>()

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const { items, upload } = useFileUploader()
const toast = useToast()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const removing = ref(false)
const busy = computed(() => items.value.some(i => i.status === 'uploading'))
const progress = computed(() => items.value.at(-1)?.progress ?? 0)

async function take(file: File | undefined) {
  if (!file) return
  if (!IMAGE_TYPES.includes(file.type)) {
    toast.add({ title: 'Подходят только JPEG, PNG или WebP', color: 'error', icon: 'i-hugeicons-alert-circle' })
    return
  }
  const done = await upload(file, props.target)
  const last = items.value.at(-1)
  if (!done && last?.error) toast.add({ title: last.error, color: 'error', icon: 'i-hugeicons-alert-circle' })
  if (done) emit('changed')
}

async function onRemove() {
  if (!props.remove) return
  removing.value = true
  try {
    await props.remove()
    emit('changed')
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось убрать картинку'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
  finally {
    removing.value = false
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  void take(e.dataTransfer?.files?.[0])
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  void take(el.files?.[0])
  el.value = ''
}
</script>

<template>
  <div class="flex items-center gap-4">
    <button
      type="button"
      class="relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden bg-elevated text-xl font-semibold text-default transition"
      :class="[shape === 'circle' ? 'rounded-full' : 'rounded-2xl', dragging ? 'ring-2 ring-accent-500' : '']"
      aria-label="Загрузить картинку"
      @click="input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <img v-if="currentUrl" :src="currentUrl" alt="" width="64" height="64" class="size-full object-cover" loading="lazy" decoding="async">
      <span v-else>{{ fallback }}</span>
      <span v-if="busy" class="absolute inset-x-0 bottom-0 h-1 bg-accent-500 transition-all" :style="{ width: `${progress * 100}%` }" />
    </button>
    <div class="flex flex-col gap-1">
      <div class="flex gap-2">
        <UButton size="sm" color="neutral" variant="soft" :loading="busy" @click="input?.click()">
          {{ currentUrl ? 'Заменить' : 'Загрузить' }}
        </UButton>
        <UButton v-if="currentUrl && remove" size="sm" color="neutral" variant="ghost" :loading="removing" @click="onRemove">
          Убрать
        </UButton>
      </div>
      <p class="text-xs text-muted">JPEG, PNG или WebP до 5 МБ. Можно перетащить.</p>
    </div>
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onPick">
  </div>
</template>
