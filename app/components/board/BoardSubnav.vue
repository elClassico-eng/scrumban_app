<script setup lang="ts">
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
  boardName: string | undefined
  canRename: boolean
}>()

const wsId = computed(() => props.workspaceId)
const { update } = useBoardsApi(wsId)
const toast = useToast()

const isEditing = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startEdit() {
  if (!props.canRename) return
  draftName.value = props.boardName ?? ''
  isEditing.value = true
  nextTick(() => inputRef.value?.focus())
}

function cancelEdit() {
  isEditing.value = false
  draftName.value = ''
}

async function commitEdit() {
  const trimmed = draftName.value.trim()
  if (!trimmed || trimmed === props.boardName) {
    cancelEdit()
    return
  }
  try {
    await update.mutateAsync({ boardId: props.boardId, name: trimmed })
    isEditing.value = false
  }
  catch {
    toast.add({
      title: 'Не удалось переименовать доску',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 pb-3 border-b border-default">
    <div class="flex items-center gap-3 min-w-0">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        class="text-sm text-muted hover:text-default flex items-center gap-1 shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        К доскам
      </NuxtLink>
      <input
        v-if="isEditing"
        ref="inputRef"
        v-model="draftName"
        class="text-xl font-bold tracking-tight bg-transparent border-b border-primary outline-none min-w-0 flex-1"
        :disabled="update.isPending.value"
        @keyup.enter="commitEdit"
        @keyup.esc="cancelEdit"
        @blur="commitEdit"
      >
      <h1
        v-else
        class="text-xl font-bold tracking-tight truncate"
        :class="canRename ? 'cursor-text hover:text-primary transition-colors' : ''"
        :title="canRename ? 'Двойной клик — переименовать' : ''"
        @dblclick="startEdit"
      >
        {{ boardName ?? 'Доска' }}
      </h1>
    </div>
    <nav class="flex gap-1 shrink-0">
      <NuxtLink
        :to="pageRoutes.board(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Доска
      </NuxtLink>
      <NuxtLink
        :to="pageRoutes.boardSprints(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Спринты
      </NuxtLink>
      <NuxtLink
        :to="pageRoutes.boardAnalytics(workspaceId, boardId)"
        class="px-3 py-1.5 rounded-md text-sm text-muted hover:bg-accented hover:text-default transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      >
        Аналитика
      </NuxtLink>
    </nav>
  </div>
</template>