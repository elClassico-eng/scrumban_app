<script setup lang="ts">
import type { ActivityEvent } from '#shared/types/activity'
import type { TaskEventType } from '#shared/types/domain'
import { pageRoutes } from '~/routing'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: membersList } = useMembersApi(wsId)
const { list: boardsList } = useBoardsApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Активность`
    : 'Активность — Scrumban',
})

const EVENT_OPTIONS: { value: TaskEventType; label: string }[] = [
  { value: 'task_created', label: 'Создана' },
  { value: 'task_moved', label: 'Перемещена' },
  { value: 'task_closed', label: 'Закрыта' },
  { value: 'task_reopened', label: 'Переоткрыта' },
  { value: 'task_assigned', label: 'Назначена' },
  { value: 'task_updated', label: 'Обновлена' },
  { value: 'task_archived', label: 'Архивирована' },
  { value: 'task_commented', label: 'Прокомментирована' },
  { value: 'task_comment_deleted', label: 'Удалён комментарий' },
]

const EVENT_ICON: Record<TaskEventType, string> = {
  task_created: 'i-lucide-plus-circle',
  task_moved: 'i-lucide-arrow-right-circle',
  task_closed: 'i-lucide-check-circle',
  task_reopened: 'i-lucide-rotate-ccw',
  task_assigned: 'i-lucide-user-check',
  task_updated: 'i-lucide-pencil',
  task_archived: 'i-lucide-archive',
  task_commented: 'i-lucide-message-square',
  task_comment_deleted: 'i-lucide-message-square-off',
}

const filters = computed(() => ({
  board: (route.query.board as string | undefined) || undefined,
  actor: (route.query.actor as string | undefined) || undefined,
  event: (route.query.event as string | undefined) || undefined,
  from: (route.query.from as string | undefined) || undefined,
  to: (route.query.to as string | undefined) || undefined,
}))

const selectedEventTypes = computed<TaskEventType[]>(() => {
  const raw = filters.value.event
  if (!raw) return []
  return raw.split(',').filter((s): s is TaskEventType =>
    EVENT_OPTIONS.some(o => o.value === s),
  )
})

function updateQuery(patch: Record<string, string | undefined | null>) {
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string') next[k] = v
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') delete next[k]
    else next[k] = v
  }
  router.replace({ query: next })
}

function toggleEventType(type: TaskEventType) {
  const current = selectedEventTypes.value
  const next = current.includes(type)
    ? current.filter(t => t !== type)
    : [...current, type]
  updateQuery({ event: next.length > 0 ? next.join(',') : null })
}

function clearFilters() {
  router.replace({ query: {} })
}

const hasAnyFilter = computed(() =>
  !!filters.value.board || !!filters.value.actor
  || !!filters.value.event || !!filters.value.from || !!filters.value.to,
)

const { list } = useActivityApi(wsId, filters)
const events = computed<ActivityEvent[]>(() => list.data.value?.events ?? [])

const groupedByDay = computed(() => {
  const out: { day: string; label: string; events: ActivityEvent[] }[] = []
  const dayLabel = new Intl.DateTimeFormat('ru', {
    day: '2-digit', month: 'long', weekday: 'long',
  })
  for (const e of events.value) {
    const d = new Date(e.createdAt)
    const day = d.toISOString().slice(0, 10)
    let bucket = out.find(b => b.day === day)
    if (!bucket) {
      bucket = { day, label: dayLabel.format(d), events: [] }
      out.push(bucket)
    }
    bucket.events.push(e)
  }
  return out
})

const timeFmt = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' })

function actorLabel(e: ActivityEvent): string {
  if (!e.actorId) return 'удалённый пользователь'
  return displayName({
    firstName: e.actorFirstName,
    lastName: e.actorLastName,
    email: e.actorEmail,
  })
}

function targetFor(e: ActivityEvent) {
  if (!e.boardId || !e.taskId) return null
  return pageRoutes.task(wsId.value, e.boardId, e.taskId)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Активность команды</h1>
        <p class="text-sm text-muted mt-1">События по задачам этого workspace</p>
      </div>
      <UButton
        v-if="hasAnyFilter"
        icon="i-lucide-x"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="clearFilters"
      >
        Сбросить фильтры
      </UButton>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div class="space-y-6 min-w-0">
        <div v-if="list.isLoading.value" class="text-center py-12 text-muted">
          <UIcon name="i-lucide-loader" class="animate-spin size-6" />
        </div>

        <div
          v-else-if="events.length === 0"
          class="text-center py-16 space-y-3 rounded-3xl border border-dashed border-default"
        >
          <UIcon name="i-lucide-activity" class="size-12 text-muted mx-auto" />
          <p class="font-medium">Нет событий</p>
          <p class="text-sm text-muted">
            За последние 14 дней по этим фильтрам ничего не происходило.
          </p>
        </div>

        <section
          v-for="group in groupedByDay"
          :key="group.day"
          class="space-y-2"
        >
          <h2 class="text-xs uppercase tracking-wide text-muted">{{ group.label }}</h2>
          <ol class="space-y-1">
            <li
              v-for="e in group.events"
              :key="e.id"
              class="flex gap-3 px-3 py-2 rounded hover:bg-elevated/40 transition-colors"
            >
              <UIcon :name="EVENT_ICON[e.eventType]" class="size-4 mt-1 text-muted shrink-0" />
              <div class="flex-1 min-w-0 text-sm">
                <p class="leading-snug">
                  <span class="font-medium">{{ actorLabel(e) }}</span>
                  <span class="text-muted"> — </span>
                  <span>{{ humanizeTaskEventType(e.eventType).toLowerCase() }}</span>
                  <template v-if="targetFor(e)">
                    <span class="text-muted"> — </span>
                    <NuxtLink
                      :to="targetFor(e)!"
                      class="text-primary hover:underline truncate inline-block max-w-full sm:max-w-[40ch] align-bottom"
                    >
                      {{ e.taskTitle ?? 'удалённая задача' }}
                    </NuxtLink>
                  </template>
                </p>
                <p class="text-xs text-muted">
                  {{ timeFmt.format(new Date(e.createdAt)) }}
                  <template v-if="e.boardName">
                    · {{ e.boardName }}
                  </template>
                </p>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <aside class="space-y-5 min-w-0">
        <div class="space-y-2">
          <p class="text-xs uppercase tracking-wide text-muted">Доска</p>
          <USelect
            :model-value="filters.board ?? '__all__'"
            :items="[
              { label: 'Все доски', value: '__all__' },
              ...(boardsList.data.value?.boards ?? []).map(b => ({ label: b.name, value: b.id })),
            ]"
            class="w-full"
            @update:model-value="(v: string) => updateQuery({ board: v === '__all__' ? null : v })"
          />
        </div>

        <div class="space-y-2">
          <p class="text-xs uppercase tracking-wide text-muted">Участник</p>
          <USelect
            :model-value="filters.actor ?? '__all__'"
            :items="[
              { label: 'Все участники', value: '__all__' },
              ...(membersList.data.value?.members ?? []).map(m => ({
                label: displayName(m),
                value: m.userId,
              })),
            ]"
            class="w-full"
            @update:model-value="(v: string) => updateQuery({ actor: v === '__all__' ? null : v })"
          />
        </div>

        <div class="space-y-2">
          <p class="text-xs uppercase tracking-wide text-muted">Тип события</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in EVENT_OPTIONS"
              :key="opt.value"
              type="button"
              class="text-xs px-2.5 py-1 rounded-full border transition-colors"
              :class="selectedEventTypes.includes(opt.value)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-default text-muted hover:text-default'"
              @click="toggleEventType(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>