<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list, create, update, remove } = useTaskChecklistApi(wsId, bId, tId)
const toast = useToast()

const items = computed(() => list.data.value?.items ?? [])
const progress = computed(() => {
  const total = items.value.length
  if (total === 0) return null
  const done = items.value.filter(i => i.isDone).length
  return { done, total, percent: Math.round((done / total) * 100) }
})

const newTitle = ref('')
const adding = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function startAdd() {
  adding.value = true
  nextTick(() => inputRef.value?.focus())
}

async function commitAdd() {
  const title = newTitle.value.trim()
  if (!title) {
    adding.value = false
    newTitle.value = ''
    return
  }
  try {
    await create.mutateAsync({ title })
    newTitle.value = ''
    nextTick(() => inputRef.value?.focus())
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить пункт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function cancelAdd() {
  adding.value = false
  newTitle.value = ''
}

function onToggle(itemId: string, isDone: boolean) {
  update.mutate({ itemId, isDone })
}

async function onRemove(itemId: string) {
  try {
    await remove.mutateAsync(itemId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить пункт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

// Inline-edit a title. Active item id is local UI state; commit writes
// through update.mutate with optimistic patch from the composable.
const editingId = ref<string | null>(null)
const editDraft = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

function startEdit(itemId: string, currentTitle: string) {
  editingId.value = itemId
  editDraft.value = currentTitle
  nextTick(() => editInputRef.value?.focus())
}

async function commitEdit() {
  const id = editingId.value
  if (!id) return
  const title = editDraft.value.trim()
  if (!title) {
    editingId.value = null
    return
  }
  const current = items.value.find(i => i.id === id)
  if (current && title === current.title) {
    editingId.value = null
    return
  }
  try {
    await update.mutateAsync({ itemId: id, title })
    editingId.value = null
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось обновить пункт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-muted uppercase tracking-wide flex items-center gap-2">
        <span>Чек-лист</span>
        <span v-if="progress" class="text-[11px] normal-case tracking-normal">
          {{ progress.done }}/{{ progress.total }}
        </span>
      </p>
      <UButton
        v-if="!adding"
        icon="i-lucide-plus"
        size="xs"
        variant="ghost"
        color="neutral"
        @click="startAdd"
      >
        Добавить пункт
      </UButton>
    </div>

    <div v-if="progress" class="h-1.5 rounded-full bg-elevated overflow-hidden">
      <div
        class="h-full bg-success transition-all"
        :style="{ width: `${progress.percent}%` }"
      />
    </div>

    <div v-if="items.length > 0" class="space-y-1">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-elevated group"
      >
        <UCheckbox
          :model-value="item.isDone"
          @update:model-value="(v: boolean | 'indeterminate') => onToggle(item.id, v === true)"
        />
        <input
          v-if="editingId === item.id"
          ref="editInputRef"
          v-model="editDraft"
          class="flex-1 bg-transparent text-sm outline-none border-b border-primary"
          @keyup.enter="commitEdit"
          @keyup.esc="cancelEdit"
          @blur="commitEdit"
        >
        <button
          v-else
          class="flex-1 text-sm text-left truncate"
          :class="item.isDone ? 'line-through text-muted' : ''"
          @click="startEdit(item.id, item.title)"
        >
          {{ item.title }}
        </button>
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          title="Удалить пункт"
          @click="onRemove(item.id)"
        />
      </div>
    </div>

    <div v-if="adding" class="flex items-center gap-2 px-2 py-1.5">
      <UCheckbox :model-value="false" disabled />
      <input
        ref="inputRef"
        v-model="newTitle"
        placeholder="Что нужно сделать..."
        class="flex-1 bg-transparent text-sm outline-none border-b border-primary"
        :disabled="create.isPending.value"
        @keyup.enter="commitAdd"
        @keyup.esc="cancelAdd"
        @blur="commitAdd"
      >
    </div>

    <p v-if="items.length === 0 && !adding" class="text-xs text-muted px-2 py-1.5">
      Пока нет пунктов. Добавь первый — например, «Подготовить макет».
    </p>
  </div>
</template>