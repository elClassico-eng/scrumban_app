<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { TaskComment, TaskCommentListResponse } from '#shared/types/comment'
import type { MemberView } from '#shared/types/workspace'

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
const qc = useQueryClient()

const comments = computed(() => list.data.value?.comments ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const myUserId = computed(() => auth.user?.id ?? null)
const myRole = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value)?.role,
)
const isAdmin = computed(() => hasRole(myRole.value, 'admin'))
const commentsQueryKey = computed(() => ['task-comments', wsId.value, bId.value, tId.value])

const EDIT_WINDOW_MS = 5 * 60 * 1000
const UNDO_DELAY_MS = 5000

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
const composerMentions = ref<Record<string, string>>({})
const composerRef = ref<HTMLTextAreaElement | null>(null)

function insertMention(member: MemberView) {
  const name = displayName(member)
  composerMentions.value[name] = member.userId
  const el = composerRef.value
  if (!el) {
    composerBody.value = `${composerBody.value} @${name} `.replace(/^\s+/, '')
    return
  }
  const start = el.selectionStart ?? composerBody.value.length
  const end = el.selectionEnd ?? composerBody.value.length
  const before = composerBody.value.slice(0, start)
  const after = composerBody.value.slice(end)
  const insert = `@${name} `
  composerBody.value = `${before}${insert}${after}`
  nextTick(() => {
    el.focus()
    const caret = before.length + insert.length
    el.setSelectionRange(caret, caret)
  })
}

const mentionPickerOpen = ref(false)
function openMentionPicker() {
  mentionPickerOpen.value = true
}

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key !== '@') return
  const el = e.target as HTMLTextAreaElement
  const cursor = el.selectionStart ?? 0
  const prev = composerBody.value[cursor - 1] ?? ''
  if (cursor === 0 || /\s/.test(prev)) {
    e.preventDefault()
    mentionPickerOpen.value = true
  }
}

function onMentionSelectForComposer(member: MemberView) {
  insertMention(member)
}

async function submitComment() {
  const visible = composerBody.value.trim()
  if (!visible) return
  const body = serializeMentions(visible, composerMentions.value)
  try {
    await create.mutateAsync({ body })
    composerBody.value = ''
    composerMentions.value = {}
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
const editVisible = ref('')
const editMentions = ref<Record<string, string>>({})
const editRef = ref<HTMLTextAreaElement | null>(null)
const editPickerOpen = ref(false)

function startEdit(c: TaskComment) {
  const { text, mentions } = deserializeMentions(c.body)
  editingId.value = c.id
  editVisible.value = text
  editMentions.value = mentions
}

function cancelEdit() {
  editingId.value = null
  editVisible.value = ''
  editMentions.value = {}
}

function onEditKeydown(e: KeyboardEvent) {
  if (e.key !== '@') return
  const el = e.target as HTMLTextAreaElement
  const cursor = el.selectionStart ?? 0
  const prev = editVisible.value[cursor - 1] ?? ''
  if (cursor === 0 || /\s/.test(prev)) {
    e.preventDefault()
    editPickerOpen.value = true
  }
}

function onMentionSelectForEdit(member: MemberView) {
  const name = displayName(member)
  editMentions.value[name] = member.userId
  const el = editRef.value
  if (!el) {
    editVisible.value = `${editVisible.value} @${name} `.replace(/^\s+/, '')
    return
  }
  const start = el.selectionStart ?? editVisible.value.length
  const end = el.selectionEnd ?? editVisible.value.length
  const before = editVisible.value.slice(0, start)
  const after = editVisible.value.slice(end)
  const insert = `@${name} `
  editVisible.value = `${before}${insert}${after}`
  nextTick(() => {
    el.focus()
    const caret = before.length + insert.length
    el.setSelectionRange(caret, caret)
  })
}

async function commitEdit() {
  const id = editingId.value
  if (!id) return
  const visible = editVisible.value.trim()
  if (!visible) return
  const body = serializeMentions(visible, editMentions.value)
  try {
    await update.mutateAsync({ commentId: id, body })
    editingId.value = null
    editVisible.value = ''
    editMentions.value = {}
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось обновить комментарий'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

function onDelete(c: TaskComment) {
  const prev = qc.getQueryData<TaskCommentListResponse>(commentsQueryKey.value)
  if (prev) {
    qc.setQueryData<TaskCommentListResponse>(commentsQueryKey.value, {
      comments: prev.comments.filter((x: TaskComment) => x.id !== c.id),
    })
  }

  let cancelled = false
  const timer = setTimeout(async () => {
    if (cancelled) return
    try {
      await remove.mutateAsync(c.id)
    }
    catch (err) {
      if (prev) qc.setQueryData(commentsQueryKey.value, prev)
      toast.add({
        title: getErrorMessage(err, 'Не удалось удалить комментарий'),
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }, UNDO_DELAY_MS)

  toast.add({
    title: 'Комментарий удалён',
    icon: 'i-lucide-trash-2',
    duration: UNDO_DELAY_MS,
    actions: [
      {
        label: 'Отменить',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          cancelled = true
          clearTimeout(timer)
          if (prev) qc.setQueryData(commentsQueryKey.value, prev)
        },
      },
    ],
  })
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
        <UserAvatar :user="c.author" size="md" />

        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-medium">{{ displayName(c.author) }}</span>
            <span class="text-xs text-muted">{{ formatRelativeDate(c.createdAt) }}</span>
            <span v-if="c.editedAt" class="text-xs text-muted">(изменено)</span>
          </div>

          <div v-if="editingId === c.id" class="mt-1 space-y-2">
            <UTextarea
              ref="editRef"
              v-model="editVisible"
              :rows="3"
              class="w-full"
              autofocus
              @keydown="onEditKeydown"
            />
            <div class="flex items-center justify-between gap-2">
              <UButton
                icon="i-lucide-at-sign"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="editPickerOpen = true"
              >
                Упомянуть
              </UButton>
              <div class="flex items-center gap-2">
                <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit">
                  Отмена
                </UButton>
                <UButton
                  size="xs"
                  :loading="update.isPending.value"
                  :disabled="!editVisible.trim()"
                  @click="commitEdit"
                >
                  Сохранить
                </UButton>
              </div>
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

        <UDropdownMenu
          v-if="editingId !== c.id && (canEdit(c) || canDelete(c))"
          :items="[
            ...(canEdit(c)
              ? [{ label: 'Редактировать', icon: 'i-lucide-pencil', onSelect: () => startEdit(c) }]
              : []),
            ...(canDelete(c)
              ? [{ label: 'Удалить', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => onDelete(c) }]
              : []),
          ]"
        >
          <UButton
            icon="i-lucide-more-horizontal"
            size="xs"
            variant="ghost"
            color="neutral"
            class="shrink-0"
          />
        </UDropdownMenu>
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
        @keydown="onComposerKeydown"
      />
      <div class="flex items-center justify-between gap-2">
        <UButton
          icon="i-lucide-at-sign"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="openMentionPicker"
        >
          Упомянуть
        </UButton>
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

    <TaskMentionPicker
      v-model:open="mentionPickerOpen"
      :members="members"
      @select="onMentionSelectForComposer"
    />
    <TaskMentionPicker
      v-model:open="editPickerOpen"
      :members="members"
      @select="onMentionSelectForEdit"
    />
  </div>
</template>