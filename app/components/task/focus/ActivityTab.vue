<script setup lang="ts">
import type { MaybeRef } from 'vue'
import type { TaskEvent } from '#shared/types/task'
import type { TaskEventType } from '#shared/types/domain'

const props = defineProps<{
  events: TaskEvent[]
  workspaceId: MaybeRef<string>
  boardId: MaybeRef<string>
}>()

const { list: membersList } = useMembersApi(props.workspaceId)
const { list: columnsList } = useColumnsApi(props.workspaceId, props.boardId)

const members = computed(() => membersList.data.value?.members ?? [])
const columns = computed(() => columnsList.data.value?.columns ?? [])

const columnNameMap = computed(() => {
  const m: Record<string, string> = {}
  for (const c of columns.value) m[c.id] = c.name
  return m
})

const EVENT_ICON: Record<TaskEventType, string> = {
  task_created: 'i-lucide-plus',
  task_moved: 'i-lucide-arrow-right',
  task_closed: 'i-lucide-check',
  task_reopened: 'i-lucide-rotate-ccw',
  task_assigned: 'i-lucide-user',
  task_updated: 'i-lucide-pencil',
  task_archived: 'i-lucide-archive',
  task_commented: 'i-lucide-message-square',
  task_comment_deleted: 'i-lucide-message-square-off',
  task_added_to_sprint: 'i-lucide-circle-plus',
  task_removed_from_sprint: 'i-lucide-circle-minus',
  task_blocked: 'i-lucide-octagon-x',
  task_unblocked: 'i-lucide-octagon',
}

function actorMember(actorId: string | null) {
  if (!actorId) return null
  return members.value.find(m => m.userId === actorId) ?? null
}
function actorFirstName(actorId: string | null): string {
  const m = actorMember(actorId)
  if (!m) return 'Кто-то'
  return m.firstName?.trim() || displayName(m)
}

function fromColumnName(e: TaskEvent): string | null {
  if (!e.fromColumnId) return null
  return columnNameMap.value[e.fromColumnId] ?? null
}
function toColumnName(e: TaskEvent): string | null {
  if (!e.toColumnId) return null
  return columnNameMap.value[e.toColumnId] ?? null
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}
function timeLabel(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return `сегодня · ${formatTime(iso)}`
  if (days === 1) return `вчера · ${formatTime(iso)}`
  if (days === 2) return `позавчера · ${formatTime(iso)}`
  return `${formatDay(iso)} · ${formatTime(iso)}`
}

const sortedEvents = computed(() => {
  return [...props.events].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})
</script>

<template>
  <section>
    <div class="flex items-center gap-2 mb-3">
      <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
        История изменений
      </h4>
    </div>

    <div v-if="events.length === 0" class="text-[13px] text-muted py-1.5">
      Пока нет событий.
    </div>

    <ol v-else class="relative">
      <li
        v-for="(e, idx) in sortedEvents"
        :key="e.id"
        class="grid grid-cols-[28px_1fr] gap-3 items-start relative pb-4 last:pb-0"
      >
        <span
          v-if="idx !== sortedEvents.length - 1"
          class="absolute left-[13px] top-[30px] bottom-0 w-px bg-accented"
        />

        <div
          class="size-7 rounded-full bg-default border border-default grid place-items-center text-muted relative z-10"
        >
          <UIcon :name="EVENT_ICON[e.eventType] ?? 'i-lucide-circle'" class="size-3.5" />
        </div>

        <div class="pt-1 text-[13px] text-default leading-snug">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-semibold">{{ actorFirstName(e.actorId) }}</span>

            <template v-if="e.eventType === 'task_moved'">
              <span class="text-muted">переместил(а) задачу</span>
              <span v-if="fromColumnName(e)" class="inline-flex items-center h-5 px-1.5 rounded text-[11.5px] bg-elevated text-default">
                {{ fromColumnName(e) }}
              </span>
              <UIcon name="i-lucide-arrow-right" class="size-3 text-muted" />
              <span class="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11.5px] bg-inverted text-inverted">
                <span class="size-1.5 rounded-full bg-accent-500" />
                {{ toColumnName(e) ?? '—' }}
              </span>
            </template>

            <template v-else-if="e.eventType === 'task_assigned'">
              <span class="text-muted">назначил(а) исполнителем</span>
            </template>

            <template v-else-if="e.eventType === 'task_created'">
              <span class="text-muted">создал(а) задачу</span>
            </template>

            <template v-else-if="e.eventType === 'task_closed'">
              <span class="text-muted">закрыл(а) задачу</span>
            </template>

            <template v-else-if="e.eventType === 'task_reopened'">
              <span class="text-muted">переоткрыл(а) задачу</span>
            </template>

            <template v-else-if="e.eventType === 'task_archived'">
              <span class="text-muted">архивировал(а) задачу</span>
            </template>

            <template v-else-if="e.eventType === 'task_commented'">
              <span class="text-muted">оставил(а) комментарий</span>
            </template>

            <template v-else-if="e.eventType === 'task_comment_deleted'">
              <span class="text-muted">удалил(а) комментарий</span>
            </template>

            <template v-else>
              <span class="text-muted">{{ humanizeTaskEventType(e.eventType).toLowerCase() }}</span>
            </template>
          </div>
          <div class="text-[11.5px] text-muted mt-0.5">{{ timeLabel(e.createdAt) }}</div>
        </div>
      </li>
    </ol>
  </section>
</template>