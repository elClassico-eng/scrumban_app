<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { MemberView } from '#shared/types/workspace'

type SaveResult = 'ok' | 'conflict' | 'error'

const props = defineProps<{
  description: string
  editable: boolean
  members: MemberView[]
  save: (next: string, base: string) => Promise<SaveResult>
  uploadImage?: (file: File) => Promise<{ url: string, name: string } | null>
}>()
const emit = defineEmits<{ addFiles: [files: File[]] }>()

const draft = ref(props.description)
const base = ref(props.description)
const dirty = ref(false)
const focused = ref(false)
const status = ref<'idle' | 'saving' | 'saved'>('idle')
const filePicker = ref<HTMLInputElement | null>(null)
let saving = false

function syncFromServer() {
  if (dirty.value || focused.value) return
  draft.value = props.description
  base.value = props.description
}

watch(() => props.description, syncFromServer)

async function flush() {
  if (!dirty.value || saving) return
  saving = true
  dirty.value = false
  status.value = 'saving'
  const next = draft.value
  const result = await props.save(next, base.value)
  saving = false
  if (result === 'ok') {
    base.value = next
    status.value = 'saved'
  }
  else {
    status.value = 'idle'
    if (result === 'error') {
      dirty.value = true
      return
    }
  }
  if (dirty.value) flushSoon()
}

const flushSoon = useDebounceFn(flush, 1000)

function onUserEdit() {
  dirty.value = true
  status.value = 'idle'
  flushSoon()
}

function onBlur() {
  focused.value = false
  void flush()
  syncFromServer()
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  const upload = props.uploadImage
  const images = upload ? files.filter(f => f.type.startsWith('image/')) : []
  const rest = files.filter(f => !images.includes(f))
  if (rest.length) emit('addFiles', rest)
  for (const f of images) {
    void upload!(f).then((img) => {
      if (!img) return
      draft.value = `${draft.value}${draft.value ? '\n\n' : ''}![${img.name}](${img.url})`
      onUserEdit()
    })
  }
}

onBeforeUnmount(() => {
  void flush()
})
</script>

<template>
  <section>
    <div class="mb-2.5 flex items-center gap-2">
      <h4 class="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        Описание
      </h4>
      <span v-if="status === 'saving'" class="text-[11px] text-dimmed">Сохраняется…</span>
      <span v-else-if="status === 'saved'" class="text-[11px] text-dimmed">Сохранено</span>
      <div class="flex-1" />
      <button
        v-if="editable"
        type="button"
        class="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-dashed border-default px-2 text-[12px] text-muted transition-colors hover:border-solid hover:border-accent-500 hover:text-accent-500"
        @click="filePicker?.click()"
      >
        <UIcon name="i-hugeicons-plus" class="size-3" />
        Вложение
      </button>
      <input ref="filePicker" type="file" multiple class="hidden" @change="onPick">
    </div>
    <p v-if="!editable && !description" class="m-0 text-[14px] italic text-muted">
      Описания нет
    </p>
    <LazyCommonRichEditor
      v-else
      v-model="draft"
      variant="document"
      :editable="editable"
      :members="members"
      :upload-image="uploadImage"
      placeholder="Опишите задачу: контекст, ссылки, критерии готовности. «/» – блоки, «@» – упомянуть"
      @user-edit="onUserEdit"
      @focus="focused = true"
      @blur="onBlur"
    />
  </section>
</template>
