<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { TaskComment, TaskCommentListResponse } from '#shared/types/comment'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  workspaceId: MaybeRef<string>
  boardId: MaybeRef<string>
  taskId: MaybeRef<string>
}>()

const { list, create, update, remove } = useTaskCommentsApi(props.workspaceId, props.boardId, props.taskId)
const { list: membersList } = useMembersApi(props.workspaceId)
const { list: workspacesList } = useWorkspacesApi()
const auth = useAuthStore()
const toast = useToast()
const qc = useQueryClient()

const comments = computed(() => list.data.value?.comments ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const myUserId = computed(() => auth.user?.id ?? null)
const myRole = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === unref(props.workspaceId))?.role,
)
const isAdmin = computed(() => hasRole(myRole.value, 'admin'))
const commentsQueryKey = computed(() => [
  'task-comments',
  unref(props.workspaceId),
  unref(props.boardId),
  unref(props.taskId),
])

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

function commentRole(c: TaskComment): string {
  if (!c.author) return ''
  const m = members.value.find(mm => mm.userId === c.author!.id)
  if (!m) return ''
  return humanizeRole(m.role).toUpperCase()
}

const composerBody = ref('')
const composerMentions = ref<Record<string, string>>({})
const composerRef = ref<HTMLTextAreaElement | null>(null)

function insertMentionInto(refEl: HTMLTextAreaElement | null, value: Ref<string>, name: string) {
  const el = refEl
  if (!el) {
    value.value = `${value.value} @${name} `.replace(/^\s+/, '')
    return
  }
  const start = el.selectionStart ?? value.value.length
  const end = el.selectionEnd ?? value.value.length
  const before = value.value.slice(0, start)
  const after = value.value.slice(end)
  const insert = `@${name} `
  value.value = `${before}${insert}${after}`
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
  const name = displayName(member)
  composerMentions.value[name] = member.userId
  insertMentionInto(composerRef.value, composerBody, name)
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
  insertMentionInto(editRef.value, editVisible, name)
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
    try { await remove.mutateAsync(c.id) }
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

const composerHasContent = computed(() => composerBody.value.trim().length > 0)

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}
function timeLabel(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return `сегодня в ${formatTime(iso)}`
  if (days === 1) return `вчера в ${formatTime(iso)}`
  return `${formatDay(iso)} в ${formatTime(iso)}`
}
</script>

<template>
  <section>
    <div class="flex items-center gap-2 mb-3">
      <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
        Комментарии
      </h4>
      <span
        v-if="comments.length > 0"
        class="h-5 px-1.5 rounded-full text-[11px] inline-flex items-center bg-elevated text-muted"
      >
        {{ comments.length }}
      </span>
    </div>

    <div v-if="comments.length === 0" class="text-[13px] text-muted py-1.5 mb-4">
      Пока нет комментариев. Начни обсуждение задачи.
    </div>

    <div v-else class="flex flex-col gap-4 mb-6">
      <div
        v-for="c in comments"
        :key="c.id"
        class="grid grid-cols-[32px_1fr] gap-3 group"
      >
        <UserAvatar :user="c.author" size="md" />

        <div>
          <div class="flex items-baseline gap-2 mb-1 flex-wrap">
            <span class="text-[13px] font-semibold text-default">
              {{ displayName(c.author) }}
            </span>
            <span
              v-if="commentRole(c)"
              class="text-[10px] font-semibold uppercase tracking-[0.04em] text-muted bg-accented px-1.5 py-px rounded-full"
            >
              {{ commentRole(c) }}
            </span>
            <span class="text-[11.5px] text-muted">{{ timeLabel(c.createdAt) }}</span>
            <span v-if="c.editedAt" class="text-[11.5px] text-muted">(изменено)</span>
            <div class="flex-1" />
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
              <button
                type="button"
                class="size-6 rounded-md grid place-items-center text-muted opacity-0 group-hover:opacity-100 hover:bg-elevated cursor-pointer transition-all"
                title="Действия"
              >
                <UIcon name="i-lucide-more-horizontal" class="size-3.5" />
              </button>
            </UDropdownMenu>
          </div>

          <div
            v-if="editingId === c.id"
            class="rounded-lg bg-default border border-default focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-50 transition-colors"
          >
            <textarea
              ref="editRef"
              v-model="editVisible"
              rows="3"
              class="w-full bg-transparent border-0 outline-none px-3.5 py-2.5 text-[13.5px] text-default leading-relaxed resize-none"
              @keydown="onEditKeydown"
            />
            <div class="flex items-center gap-1 px-2 py-1.5 border-t border-default">
              <button
                type="button"
                class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default cursor-pointer transition-colors"
                @click="editPickerOpen = true"
              >
                <UIcon name="i-lucide-at-sign" class="size-3.5" />
              </button>
              <div class="flex-1" />
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

          <div
            v-else
            class="rounded-tl-[4px] rounded-[12px] bg-elevated px-3.5 py-2.5"
          >
            <p class="m-0 text-[13.5px] text-default leading-[1.55] whitespace-pre-wrap break-words">
              <template
                v-for="(seg, idx) in parseMentionSegments(c.body)"
                :key="idx"
              >
                <span
                  v-if="seg.type === 'mention'"
                  class="text-accent-600 font-medium bg-accent-50 rounded px-1"
                >@{{ seg.name }}</span>
                <template v-else>{{ seg.value }}</template>
              </template>
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasRole(myRole, 'member')" class="sticky bottom-0 -mx-4 px-4 sm:-mx-7 sm:px-7 pt-3 pb-1 bg-gradient-to-t from-[var(--ui-bg)] via-[var(--ui-bg)]/95 to-transparent">
      <div
        class="rounded-lg border border-default bg-default focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-50 transition-colors"
      >
        <textarea
          ref="composerRef"
          v-model="composerBody"
          rows="2"
          placeholder="Написать комментарий, @упомянуть коллегу…"
          class="w-full bg-transparent border-0 outline-none px-3.5 py-2.5 text-[13.5px] text-default leading-relaxed resize-none"
          @keydown="onComposerKeydown"
        />
        <div class="flex items-center gap-1 px-2 py-1.5 border-t border-default">
          <button
            type="button"
            class="h-7 px-2 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default cursor-pointer transition-colors inline-flex items-center gap-1 text-[12px]"
            @click="openMentionPicker"
          >
            <UIcon name="i-lucide-at-sign" class="size-3.5" />
            Упомянуть
          </button>
          <div class="flex-1" />
          <UButton
            icon="i-lucide-send"
            size="sm"
            :loading="create.isPending.value"
            :disabled="!composerHasContent"
            @click="submitComment"
          >
            Отправить
          </UButton>
        </div>
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
  </section>
</template>