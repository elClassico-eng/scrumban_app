<script setup lang="ts">
import type { TaskComment } from '#shared/types/comment'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list, create, update, remove } = useTaskCommentsApi(wsId, bId, tId)
const { list: membersList } = useMembersApi(wsId)
const { list: workspacesList } = useWorkspacesApi()
const auth = useAuthStore()
const toast = useToast()

const comments = computed(() => list.data.value?.comments ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const myUserId = computed(() => auth.user?.id ?? null)
const myRole = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value)?.role,
)
const isAdmin = computed(() => hasRole(myRole.value, 'admin'))

const EDIT_WINDOW_MS = 5 * 60 * 1000

function canEdit(c: TaskComment): boolean {
  if (isAdmin.value) return true
  if (!myUserId.value || c.author?.id !== myUserId.value) return false
  return Date.now() - new Date(c.createdAt).getTime() < EDIT_WINDOW_MS
}

function canDelete(c: TaskComment): boolean {
  if (isAdmin.value) return true
  return !!myUserId.value && c.author?.id === myUserId.value
}

const composerBody = ref('')
const composerRef = ref<HTMLTextAreaElement | null>(null)

const mentionItems = computed(() =>
  members.value.map(m => ({
    label: displayName(m),
    onSelect: () => insertMention(displayName(m), m.userId),
  })),
)

function insertMention(name: string, userId: string) {
  const token = formatMentionToken(name, userId)
  const el = composerRef.value
  if (!el) {
    composerBody.value = `${composerBody.value} ${token} `.trim()
    return
  }
  const start = el.selectionStart ?? composerBody.value.length
  const end = el.selectionEnd ?? composerBody.value.length
  const before = composerBody.value.slice(0, start)
  const after = composerBody.value.slice(end)
  const insert = `${token} `
  composerBody.value = `${before}${insert}${after}`
  nextTick(() => {
    el.focus()
    const caret = start + insert.length
    el.setSelectionRange(caret, caret)
  })
}

async function submitComment() {
  const body = composerBody.value.trim()
  if (!body) return
  try {
    await create.mutateAsync({ body })
    composerBody.value = ''
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось отправить комментарий'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const editingId = ref<string | null>(null)
const editDraft = ref('')

function startEdit(c: TaskComment) {
  editingId.value = c.id
  editDraft.value = c.body
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}

async function commitEdit() {
  const id = editingId.value
  if (!id) return
  const body = editDraft.value.trim()
  if (!body) return
  try {
    await update.mutateAsync({ commentId: id, body })
    editingId.value = null
    editDraft.value = ''
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось обновить комментарий'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const confirm = useConfirm()
async function onRemove(c: TaskComment) {
  const ok = await confirm({
    title: 'Удалить комментарий?',
    description: 'Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(c.id)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить комментарий'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-muted uppercase tracking-wide flex items-center gap-2">
      <UIcon name="i-lucide-message-square" class="size-3.5" />
      <span>Комментарии</span>
      <span v-if="comments.length > 0" class="text-[11px] normal-case tracking-normal">
        {{ comments.length }}
      </span>
    </p>

    <div v-if="comments.length > 0" class="space-y-3">
      <div
        v-for="c in comments"
        :key="c.id"
        class="group flex gap-3 px-2 py-2 rounded hover:bg-elevated/40"
      >
        <div
          class="size-8 rounded-full bg-elevated flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden"
        >
          <img
            v-if="c.author?.avatarUrl"
            :src="c.author.avatarUrl"
            :alt="displayName(c.author)"
            class="size-full object-cover"
          >
          <span v-else>{{ initials(c.author) }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-medium">{{ displayName(c.author) }}</span>
            <span class="text-xs text-muted">{{ formatRelativeDate(c.createdAt) }}</span>
            <span v-if="c.editedAt" class="text-xs text-muted">(изменено)</span>
          </div>

          <div v-if="editingId === c.id" class="mt-1 space-y-2">
            <UTextarea
              v-model="editDraft"
              :rows="3"
              class="w-full"
              autofocus
            />
            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                :loading="update.isPending.value"
                @click="commitEdit"
              >
                Сохранить
              </UButton>
              <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit">
                Отмена
              </UButton>
            </div>
          </div>

          <p v-else class="mt-0.5 text-sm whitespace-pre-wrap break-words">
            <template v-for="(seg, idx) in parseMentionSegments(c.body)" :key="idx">
              <span
                v-if="seg.type === 'mention'"
                class="text-primary font-medium bg-primary/10 rounded px-1"
              >@{{ seg.name }}</span>
              <template v-else>{{ seg.value }}</template>
            </template>
          </p>
        </div>

        <div
          v-if="editingId !== c.id && (canEdit(c) || canDelete(c))"
          class="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1 shrink-0"
        >
          <UButton
            v-if="canEdit(c)"
            icon="i-lucide-pencil"
            size="xs"
            variant="ghost"
            color="neutral"
            title="Редактировать"
            @click="startEdit(c)"
          />
          <UButton
            v-if="canDelete(c)"
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="neutral"
            title="Удалить"
            @click="onRemove(c)"
          />
        </div>
      </div>
    </div>

    <p v-else-if="!list.isLoading.value" class="text-xs text-muted px-2 py-1.5">
      Пока нет комментариев.
    </p>

    <div v-if="hasRole(myRole, 'member')" class="space-y-2 pt-2">
      <UTextarea
        ref="composerRef"
        v-model="composerBody"
        :rows="3"
        placeholder="Напиши комментарий..."
        class="w-full"
      />
      <div class="flex items-center justify-between gap-2">
        <UDropdownMenu :items="mentionItems" :ui="{ content: 'w-56 max-h-60 overflow-y-auto' }">
          <UButton
            icon="i-lucide-at-sign"
            size="xs"
            variant="ghost"
            color="neutral"
          >
            Упомянуть
          </UButton>
        </UDropdownMenu>
        <UButton
          icon="i-lucide-send"
          size="sm"
          :loading="create.isPending.value"
          :disabled="!composerBody.trim()"
          @click="submitComment"
        >
          Отправить
        </UButton>
      </div>
    </div>
  </div>
</template>