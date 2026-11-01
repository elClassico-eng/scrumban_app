<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { EditorCustomHandlers, EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { MemberView } from '#shared/types/workspace'
import { MentionToken } from '~/utils/editor-mention'
import { IMAGE_OPTIONS, ImageParagraph, textOnlyMarked } from '~/utils/editor-config'

const props = withDefaults(defineProps<{
  editable?: boolean
  variant?: 'document' | 'comment'
  members?: MemberView[]
  placeholder?: string
  uploadImage?: (file: File) => Promise<{ url: string, name: string } | null>
}>(), { editable: true, variant: 'document', members: () => [], placeholder: '', uploadImage: undefined })
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ userEdit: [], blur: [], submit: [] }>()

const editorUi = computed(() => ({
  base: props.variant === 'comment' ? 'sm:px-0 *:my-1.5 [&_p]:leading-[1.55] [&_li]:my-0.5' : 'sm:px-0 *:my-3 [&_p]:leading-[1.65]',
}))

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

let lastEmitted = model.value
let applyingExternal = false

watch(model, (value) => {
  if (value === lastEmitted) return
  applyingExternal = true
  void nextTick(() => {
    applyingExternal = false
  })
})

watch(() => props.editable, value => editorRef.value?.editor?.setEditable(value))

function onUpdate(value: string) {
  lastEmitted = value
  model.value = value
  if (!applyingExternal) emit('userEdit')
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
  insertMention: () => {
    const editor = editorRef.value?.editor
    if (!editor) return
    const { from } = editor.state.selection
    const prev = editor.state.doc.textBetween(Math.max(0, from - 1), from)
    editor.chain().focus().insertContent(prev && !/\s/.test(prev) ? ' @' : '@').run()
  },
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
    :image="IMAGE_OPTIONS"
    :extensions="[ImageParagraph, MentionToken, TaskList, TaskItem.configure({ nested: true })]"
    :starter-kit="{ paragraph: false }"
    :markdown="{ marked: textOnlyMarked }"
    :placeholder="editable ? placeholder : undefined"
    :handlers="handlers"
    :editor-props="editorProps"
    :class="['rich-editor', `rich-editor--${variant}`]"
    :ui="editorUi"
    @update:model-value="onUpdate"
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
.rich-editor--document :deep(.ProseMirror[contenteditable="true"]) {
  min-height: 8rem;
}
.rich-editor--comment :deep(.ProseMirror) {
  font-size: 13.5px;
  line-height: 1.55;
}
.rich-editor--comment :deep(.ProseMirror[contenteditable="true"]) {
  min-height: 2.75rem;
  padding: 0.625rem 0.875rem;
}
.rich-editor :deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: 0.5rem;
}
.rich-editor :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}
.rich-editor :deep(li[data-checked]) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.rich-editor :deep(li[data-checked] > label) {
  flex-shrink: 0;
  margin-top: 0.25em;
}
.rich-editor :deep(li[data-checked] > div) {
  flex: 1;
  min-width: 0;
}
.rich-editor :deep(li[data-checked="true"] > div) {
  color: var(--ui-text-muted);
  text-decoration: line-through;
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
