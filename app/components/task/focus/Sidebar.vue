<script setup lang="ts">
import type { ServiceClass } from '#shared/types/domain'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'
import type { TaskAssigneeView } from '#shared/types/assignee'

const props = defineProps<{
  task: Task
  currentColumn: BoardColumn | null
  columns: BoardColumn[]
  assignees: TaskAssigneeView[]
  members: MemberView[]
  parentTask: Task | null
  subtasks: Task[]
  dueDate: string
  deadlineMeta: { date: string; countdown: string; overdue: boolean } | null
  workspaceId: string
  boardId: string
  canEdit: boolean
}>()

const emit = defineEmits<{
  'column-change': [columnId: string]
  'class-change': [value: ServiceClass]
  'assignee-add': [userId: string]
  'assignee-remove': [userId: string]
  'epic-toggle': []
  'due-date-change': [iso: string]
  'story-points-change': [value: number | null]
  'open-parent-picker': []
  'clear-parent': []
  'open-subtask-create': []
  'open-subtask-link': []
  'open-subtask': [taskId: string]
}>()

const SP_OPTIONS = STORY_POINTS_OPTIONS

const storyPointsMenu = computed(() => [
  ...SP_OPTIONS.map(n => ({
    label: String(n),
    icon: props.task.storyPoints === n ? 'i-lucide-check' : undefined,
    onSelect: () => emit('story-points-change', n),
  })),
  {
    label: 'Снять оценку',
    icon: 'i-lucide-x',
    onSelect: () => emit('story-points-change', null),
  },
])

const columnNameMap = computed(() => {
  const m: Record<string, BoardColumn> = {}
  for (const c of props.columns) m[c.id] = c
  return m
})

function subtaskStatusTone(subtask: Task): 'done' | 'progress' | 'default' {
  const col = columnNameMap.value[subtask.columnId]
  if (!col) return 'default'
  if (col.columnRole === 'done') return 'done'
  if (col.columnRole === 'in_progress' || col.columnRole === 'review') return 'progress'
  return 'default'
}

const CLASS_ICON: Record<ServiceClass, string> = {
  standard: 'i-lucide-flag',
  expedite: 'i-lucide-zap',
  intangible: 'i-lucide-circle',
  fixed_date: 'i-lucide-calendar-clock',
}

const localDueDate = ref(props.dueDate)
watch(() => props.dueDate, (v) => { localDueDate.value = v })
function onDueInput(e: Event) {
  const next = (e.target as HTMLInputElement).value
  localDueDate.value = next
  emit('due-date-change', next)
}

const columnOptions = computed(() =>
  props.columns.map(c => ({ label: c.name, onSelect: () => emit('column-change', c.id) })),
)

const classOptions = computed(() =>
  (Object.entries(SERVICE_CLASS_INFO) as [ServiceClass, typeof SERVICE_CLASS_INFO[ServiceClass]][])
    .map(([value, info]) => ({
      label: info.shortLabel,
      icon: CLASS_ICON[value],
      onSelect: () => emit('class-change', value),
    })),
)

const assigneeIdSet = computed(() => new Set(props.assignees.map(a => a.userId)))

const assigneeMenu = computed(() =>
  props.members.map((m) => {
    const isAssigned = assigneeIdSet.value.has(m.userId)
    return {
      label: displayName(m),
      avatar: m.avatarUrl ? { src: m.avatarUrl, alt: displayName(m) } : { text: initials(m) },
      disabled: isAssigned,
      onSelect: () => emit('assignee-add', m.userId),
    }
  }),
)
</script>

<template>
  <aside class="bg-muted flex flex-col min-h-0 overflow-y-auto">
    <section class="px-[18px] py-4 border-b border-default">
      <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2.5">
        Состояние
      </h5>
      <div class="flex flex-col gap-0.5">
        <TaskFocusPropRow icon="i-lucide-layers" label="Колонка">
          <UDropdownMenu :items="columnOptions">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-inverted text-inverted text-[12px] cursor-pointer"
            >
              <span class="size-1.5 rounded-full bg-accent-500" />
              {{ currentColumn?.name ?? '—' }}
              <UIcon name="i-lucide-chevron-down" class="size-3 opacity-60" />
            </button>
          </UDropdownMenu>
        </TaskFocusPropRow>

        <TaskFocusPropRow icon="i-lucide-flag" label="Класс">
          <UDropdownMenu :items="classOptions">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[12px] border cursor-pointer transition-colors"
              :class="task.serviceClass === 'expedite'
                ? 'bg-accent-500 text-white border-accent-500'
                : 'bg-elevated text-default border-default'"
            >
              <UIcon :name="CLASS_ICON[task.serviceClass]" class="size-3" />
              {{ SERVICE_CLASS_INFO[task.serviceClass].shortLabel }}
            </button>
          </UDropdownMenu>
        </TaskFocusPropRow>

        <TaskFocusPropRow icon="i-lucide-calendar" label="Дедлайн" align-start>
          <span class="flex flex-col gap-1 w-full">
            <input
              :value="localDueDate"
              type="date"
              class="bg-default border border-default rounded-md px-2 py-1 text-[12.5px] text-default font-sans focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-50 transition-colors"
              @input="onDueInput"
            >
            <span
              v-if="deadlineMeta"
              class="text-[11.5px] px-1.5 py-px rounded-full font-medium self-start"
              :class="deadlineMeta.overdue
                ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'
                : 'bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300'"
            >
              {{ deadlineMeta.countdown }}
            </span>
          </span>
        </TaskFocusPropRow>

        <TaskFocusPropRow icon="i-lucide-zap" label="Story Points">
          <UDropdownMenu :items="storyPointsMenu" :ui="{ content: 'w-28' }">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[12px] border cursor-pointer transition-colors"
              :class="task.storyPoints != null
                ? 'bg-elevated text-default border-default'
                : 'bg-transparent text-muted border-dashed border-default hover:border-accent-500 hover:text-accent-500'"
            >
              <template v-if="task.storyPoints != null">
                <span class="tabular-nums font-semibold">{{ task.storyPoints }}</span>
                <span class="text-[10.5px] text-muted">SP</span>
              </template>
              <template v-else>
                <UIcon name="i-lucide-plus" class="size-3" />
                <span>Оценить</span>
              </template>
              <UIcon name="i-lucide-chevron-down" class="size-3 opacity-60" />
            </button>
          </UDropdownMenu>
        </TaskFocusPropRow>

        <TaskFocusPropRow icon="i-lucide-crown" label="Эпик">
          <span class="flex items-center gap-2">
            <button
              type="button"
              class="relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0"
              :class="task.isEpic ? 'bg-accent-500' : 'bg-accented'"
              @click="emit('epic-toggle')"
            >
              <span
                class="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-default shadow-sm transition-transform"
                :class="task.isEpic ? 'translate-x-[14px]' : ''"
              />
            </button>
            <span class="text-[12px] text-muted">
              {{ task.isEpic ? 'Это эпик' : 'Обычная задача' }}
            </span>
          </span>
        </TaskFocusPropRow>
      </div>
    </section>

    <section class="px-[18px] py-4 border-b border-default">
      <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2.5">
        Люди
      </h5>
      <TaskFocusPropRow icon="i-lucide-users" label="Исполнители" align-start>
        <div class="flex items-center gap-1.5 flex-wrap w-full">
          <div v-if="assignees.length > 0" class="flex items-center -space-x-1.5">
            <UserAvatar
              v-for="a in assignees"
              :key="a.userId"
              :user="a"
              size="sm"
              ring
              tooltip
            />
          </div>
          <span v-else class="text-[12.5px] text-muted">Не назначены</span>

          <UDropdownMenu
            :items="assigneeMenu"
            :ui="{ content: 'w-56 max-h-60 overflow-y-auto' }"
          >
            <button
              type="button"
              class="size-6 rounded-full border border-dashed border-default text-dimmed grid place-items-center cursor-pointer hover:border-accent-500 hover:text-accent-500 transition-colors"
              title="Добавить исполнителя"
            >
              <UIcon name="i-lucide-plus" class="size-3" />
            </button>
          </UDropdownMenu>
        </div>
      </TaskFocusPropRow>

      <div v-if="assignees.length > 0" class="mt-2 flex flex-col gap-1">
        <div
          v-for="a in assignees"
          :key="a.userId"
          class="group flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-default transition-colors"
        >
          <UserAvatar :user="a" size="sm" />
          <span class="flex-1 text-[12.5px] text-default truncate">
            {{ displayName(a) }}
          </span>
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 size-5 rounded grid place-items-center text-dimmed hover:bg-elevated hover:text-default cursor-pointer transition-all"
            title="Снять"
            @click="emit('assignee-remove', a.userId)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </div>
      </div>
    </section>

    <section class="px-[18px] py-4 border-b border-default space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
            Родитель
          </h5>
          <div class="flex-1" />
          <button
            v-if="parentTask"
            type="button"
            class="text-[11px] text-muted bg-transparent border-0 cursor-pointer hover:text-accent-500 transition-colors"
            @click="emit('open-parent-picker')"
          >
            Изменить
          </button>
        </div>

        <div
          v-if="parentTask"
          role="button"
          tabindex="0"
          class="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12.5px] text-default bg-default border border-default hover:border-zinc-400 transition-colors text-left cursor-pointer"
          :title="parentTask.title"
          @click="emit('open-subtask', parentTask.id)"
          @keydown.enter="emit('open-subtask', parentTask.id)"
          @keydown.space.prevent="emit('open-subtask', parentTask.id)"
        >
          <UIcon
            v-if="parentTask.isEpic"
            name="i-lucide-crown"
            class="size-3.5 text-accent-600 shrink-0"
          />
          <UIcon
            v-else
            name="i-lucide-corner-left-up"
            class="size-3.5 text-muted shrink-0"
          />
          <span class="flex-1 truncate">{{ parentTask.title }}</span>
          <span
            v-if="parentTask.isEpic"
            class="text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-600 bg-accent-50 px-1.5 py-px rounded shrink-0"
          >
            Эпик
          </span>
          <button
            type="button"
            class="bg-transparent border-0 text-dimmed cursor-pointer p-0.5 rounded grid place-items-center hover:bg-elevated hover:text-default transition-colors shrink-0"
            title="Открепить от родителя"
            @click.stop="emit('clear-parent')"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </div>

        <button
          v-else
          type="button"
          class="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md text-[12px] text-muted bg-transparent border border-dashed border-default cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
          @click="emit('open-parent-picker')"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
          Указать родителя
        </button>
      </div>

      <div>
        <div class="flex items-center gap-2 mb-2">
          <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
            Подзадачи
          </h5>
          <span
            v-if="subtasks.length > 0"
            class="text-[11px] text-muted bg-elevated px-1.5 rounded-full"
          >
            {{ subtasks.length }}
          </span>
          <div class="flex-1" />
        </div>

        <div v-if="subtasks.length > 0" class="flex flex-col gap-1 mb-2">
          <button
            v-for="st in subtasks"
            :key="st.id"
            type="button"
            class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] bg-default border border-default hover:border-zinc-400 transition-colors text-left cursor-pointer"
            :title="st.title"
            @click="emit('open-subtask', st.id)"
          >
            <span
              class="size-2 rounded-full shrink-0"
              :class="{
                'bg-emerald-500': subtaskStatusTone(st) === 'done',
                'bg-blue-500': subtaskStatusTone(st) === 'progress',
                'bg-accented': subtaskStatusTone(st) === 'default',
              }"
            />
            <span
              class="flex-1 truncate"
              :class="subtaskStatusTone(st) === 'done' ? 'text-muted line-through' : 'text-default'"
            >
              {{ st.title }}
            </span>
            <span
              v-if="columnNameMap[st.columnId]"
              class="text-[10.5px] text-muted shrink-0"
            >
              {{ columnNameMap[st.columnId]!.name }}
            </span>
          </button>
        </div>

        <UDropdownMenu
          :items="[
            { label: 'Создать новую', icon: 'i-lucide-plus', onSelect: () => emit('open-subtask-create') },
            { label: 'Привязать существующую', icon: 'i-lucide-link', onSelect: () => emit('open-subtask-link') },
          ]"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md text-[12px] text-muted bg-transparent border border-dashed border-default cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
          >
            <UIcon name="i-lucide-plus" class="size-3" />
            Подзадача
            <UIcon name="i-lucide-chevron-down" class="size-3 opacity-60" />
          </button>
        </UDropdownMenu>
      </div>
    </section>

    <TaskFocusTimeTrackingSection
      :workspace-id="workspaceId"
      :board-id="boardId"
      :task-id="task.id"
      :can-edit="canEdit"
    />

    <section class="px-[18px] py-4">
      <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2.5">
        Метаданные
      </h5>
      <div class="flex flex-col gap-0.5">
        <TaskFocusPropRow icon="i-lucide-clock" label="Создана">
          <span class="text-[12px] text-muted">{{ formatRelativeDate(task.createdAt) }}</span>
        </TaskFocusPropRow>
        <TaskFocusPropRow icon="i-lucide-rotate-ccw" label="Переоткрытий">
          <span class="text-[13px] tabular-nums">{{ task.reopenedCount }}</span>
        </TaskFocusPropRow>
      </div>
    </section>
  </aside>
</template>