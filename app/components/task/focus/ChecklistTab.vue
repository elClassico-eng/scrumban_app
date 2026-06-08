<script setup lang="ts">
import type { MaybeRef } from 'vue'

const props = defineProps<{
  workspaceId: MaybeRef<string>
  boardId: MaybeRef<string>
  taskId: MaybeRef<string>
}>()

const { list, create, update, remove } = useTaskChecklistApi(props.workspaceId, props.boardId, props.taskId)
const toast = useToast()

const items = computed(() => list.data.value?.items ?? [])
const done = computed(() => items.value.filter(i => i.isDone).length)
const total = computed(() => items.value.length)
const pct = computed(() => total.value === 0 ? 0 : Math.round((done.value / total.value) * 100))

const adding = ref(false)
const newTitle = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

function startAdd() {
  adding.value = true
  nextTick(() => addInputRef.value?.focus())
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
    nextTick(() => addInputRef.value?.focus())
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
  <section>
    <div class="flex items-center gap-2 mb-2.5">
      <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
        Чек-лист
      </h4>
      <div class="flex-1" />
      <button
        v-if="!adding"
        type="button"
        class="h-6 px-2 rounded-md border border-dashed border-default text-[12px] text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
        @click="startAdd"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Добавить пункт
      </button>
    </div>

    <div class="border border-default rounded-lg overflow-hidden bg-default">
      <div
        v-if="items.length > 0"
        class="flex items-center gap-3 px-3.5 py-2.5 bg-muted border-b border-default"
      >
        <span class="text-[13px] font-semibold text-default">Прогресс</span>
        <div class="flex-1 max-w-[180px] h-1.5 bg-accented rounded-full overflow-hidden ml-3">
          <div
            class="h-full bg-accent-500 rounded-full transition-all"
            :style="{ width: `${pct}%` }"
          />
        </div>
        <span class="text-[11.5px] text-muted tabular-nums min-w-[36px] text-right">
          {{ done }}/{{ total }}
        </span>
      </div>

      <div
        v-for="item in items"
        :key="item.id"
        class="group flex items-center gap-2.5 px-3.5 py-2 border-t border-default first:border-t-0 hover:bg-muted transition-colors"
        :class="item.isDone ? 'is-done' : ''"
      >
        <button
          type="button"
          class="size-4 rounded grid place-items-center shrink-0 transition-colors cursor-pointer"
          :class="item.isDone
            ? 'bg-accent-500 border border-accent-500 text-white'
            : 'border-[1.5px] border-zinc-400 bg-default hover:border-accent-500'"
          @click="onToggle(item.id, !item.isDone)"
        >
          <UIcon v-if="item.isDone" name="i-lucide-check" class="size-2.5" />
        </button>

        <input
          v-if="editingId === item.id"
          ref="editInputRef"
          v-model="editDraft"
          class="flex-1 bg-transparent text-[13px] text-default outline-none border-b border-accent-500"
          @keyup.enter="commitEdit"
          @keyup.esc="cancelEdit"
          @blur="commitEdit"
        >
        <button
          v-else
          type="button"
          class="flex-1 text-left text-[13px] bg-transparent border-0 p-0 cursor-text"
          :class="item.isDone ? 'line-through text-muted' : 'text-default'"
          @click="startEdit(item.id, item.title)"
        >
          {{ item.title }}
        </button>

        <button
          type="button"
          class="opacity-0 group-hover:opacity-100 size-5 rounded grid place-items-center text-dimmed hover:text-default hover:bg-accented transition-all cursor-pointer"
          title="Удалить пункт"
          @click="onRemove(item.id)"
        >
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
      </div>

      <div
        v-if="adding"
        class="flex items-center gap-2.5 px-3.5 py-2 border-t border-default"
      >
        <span class="size-4 border-[1.5px] border-dashed border-zinc-400 rounded" />
        <input
          ref="addInputRef"
          v-model="newTitle"
          placeholder="Что нужно сделать…"
          class="flex-1 bg-transparent text-[13px] text-default outline-none border-b border-accent-500"
          :disabled="create.isPending.value"
          @keyup.enter="commitAdd"
          @keyup.esc="cancelAdd"
          @blur="commitAdd"
        >
      </div>

      <div
        v-if="items.length === 0 && !adding"
        class="px-3.5 py-3 text-[13px] text-muted"
      >
        Пока нет пунктов. Добавь первый — например, «Подготовить макет».
      </div>
    </div>
  </section>
</template>