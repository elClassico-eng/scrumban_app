<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { EditorCustomHandlers, EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { MemberView } from '#shared/types/workspace'
import { MentionToken } from '~/utils/editor-mention'

const props = withDefaults(defineProps<{
  editable?: boolean
  variant?: 'document' | 'comment'
  members?: MemberView[]
  placeholder?: string
  uploadImage?: (file: File) => Promise<{ url: string, name: string } | null>
}>(), { editable: true, variant: 'document', members: () => [], placeholder: '', uploadImage: undefined })
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ userEdit: [], focus: [], blur: [], submit: [] }>()

const editorRef = ref<{ editor: Editor | undefined } | null>(null)
const picker = ref<HTMLInputElement | null>(null)
const pendingImage = ref(0)

const handlers = {
  pickImage: {
    canExecute: () => true,
    execute: () => {
      picker.value?.click()
      return true
    },
    isActive: () => false,
  },
} satisfies EditorCustomHandlers

const toolbar: EditorToolbarItem[][] = [[
  { kind: 'mark', mark: 'bold', icon: 'i-hugeicons-text-bold', 'aria-label': 'Жирный' },
  { kind: 'mark', mark: 'italic', icon: 'i-hugeicons-text-italic', 'aria-label': 'Курсив' },
  { kind: 'mark', mark: 'strike', icon: 'i-hugeicons-text-strikethrough', 'aria-label': 'Зачёркнутый' },
  { kind: 'mark', mark: 'code', icon: 'i-hugeicons-source-code', 'aria-label': 'Код' },
  { kind: 'link', icon: 'i-hugeicons-link-01', 'aria-label': 'Ссылка' },
]]

const slashItems = computed<EditorSuggestionMenuItem<typeof handlers>[]>(() => [
  { kind: 'heading', level: 2, label: 'Заголовок', icon: 'i-hugeicons-heading-02' },
  { kind: 'heading', level: 3, label: 'Подзаголовок', icon: 'i-hugeicons-heading-03' },
  { kind: 'bulletList', label: 'Список', icon: 'i-hugeicons-left-to-right-list-bullet' },
  { kind: 'orderedList', label: 'Нумерованный список', icon: 'i-hugeicons-left-to-right-list-number' },
  { kind: 'taskList', label: 'Чек-лист', icon: 'i-hugeicons-check-list' },
  { kind: 'blockquote', label: 'Цитата', icon: 'i-hugeicons-quote-down' },
  { kind: 'codeBlock', label: 'Блок кода', icon: 'i-hugeicons-source-code-square' },
  { kind: 'horizontalRule', label: 'Разделитель', icon: 'i-hugeicons-minus-sign' },
  ...(props.uploadImage ? [{ kind: 'pickImage' as const, label: 'Картинка', icon: 'i-hugeicons-image-02' }] : []),
])

const mentionItems = computed(() => props.members.map(m => ({
  id: m.userId,
  label: displayName(m),
  avatar: m.avatarUrl ? { as: PLAIN_IMG, src: m.avatarUrl, alt: displayName(m) } : { text: initials(m) },
})))

function onUpdate(value: string) {
  model.value = value
  if (editorRef.value?.editor?.isFocused || pendingImage.value) emit('userEdit')
}

function imageFiles(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter(f => f.type.startsWith('image/'))
}

async function insertImages(files: File[]) {
  const editor = editorRef.value?.editor
  if (!editor || !props.uploadImage) return
  for (const file of files) {
    pendingImage.value++
    try {
      const uploaded = await props.uploadImage(file)
      if (uploaded) editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run()
    }
    finally {
      pendingImage.value--
    }
  }
}

const editorProps = {
  handlePaste: (_view: unknown, event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData?.files)
    if (!files.length || !props.uploadImage) return false
    void insertImages(files)
    return true
  },
  handleDrop: (_view: unknown, event: DragEvent) => {
    const files = imageFiles(event.dataTransfer?.files)
    if (!files.length || !props.uploadImage) return false
    event.preventDefault()
    event.stopPropagation()
    void insertImages(files)
    return true
  },
  handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
    if (props.variant === 'comment' && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      emit('submit')
      return true
    }
    return false
  },
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  void insertImages(imageFiles(el.files))
  el.value = ''
}

defineExpose({
  focus: () => editorRef.value?.editor?.commands.focus('end'),
  insertMention: () => editorRef.value?.editor?.chain().focus().insertContent(' @').run(),
})
</script>

<template>
  <UEditor
    ref="editorRef"
    v-slot="{ editor }"
    :model-value="model"
    content-type="markdown"
    :editable="editable"
    :mention="false"
    :extensions="[MentionToken, TaskList, TaskItem.configure({ nested: true })]"
    :starter-kit="variant === 'comment' ? { heading: false } : {}"
    :placeholder="editable ? placeholder : undefined"
    :handlers="handlers"
    :editor-props="editorProps"
    :class="['rich-editor', `rich-editor--${variant}`]"
    @update:model-value="onUpdate"
    @focus="emit('focus')"
    @blur="emit('blur')"
  >
    <template v-if="editable">
      <UEditorToolbar :editor="editor" :items="toolbar" layout="bubble" />
      <UEditorSuggestionMenu v-if="variant === 'document'" :editor="editor" :items="slashItems" />
      <UEditorMentionMenu :editor="editor" :items="mentionItems" />
    </template>
  </UEditor>
  <p v-if="pendingImage" class="mt-1 text-[12px] text-muted">Загружаем картинку…</p>
  <input ref="picker" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden" @change="onPick">
</template>

<style scoped>
.rich-editor :deep(.ProseMirror) {
  font-size: 14px;
  line-height: 1.65;
  color: var(--ui-text);
  outline: none;
}
.rich-editor--document :deep(.ProseMirror) {
  min-height: 8rem;
}
.rich-editor--comment :deep(.ProseMirror) {
  min-height: 2.75rem;
  padding: 0.625rem 0.875rem;
  font-size: 13.5px;
}
.rich-editor :deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: 0.5rem;
}
.rich-editor :deep(.mention) {
  color: var(--color-accent-600);
  background: var(--color-accent-50);
  border-radius: 0.25rem;
  padding: 0 0.25rem;
  font-weight: 500;
}
:global(.dark) .rich-editor :deep(.mention) {
  color: var(--color-accent-400);
  background: color-mix(in oklab, var(--color-accent-500) 15%, transparent);
}
</style>
