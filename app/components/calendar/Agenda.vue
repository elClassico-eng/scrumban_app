<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
import type { CalendarFilters } from '~/utils/calendar'

const props = defineProps<{
  tasks: Task[]
  selectedDay: Date | null
  members: MemberView[]
  columnsById: Record<string, string>
  filters: CalendarFilters
}>()

const emit = defineEmits<{
  'update:filters': [value: CalendarFilters]
  'open-task': [taskId: string]
  create: []
  'clear-day': []
}>()

const membersById = computed(() => {
  const m: Record<string, MemberView> = {}
  for (const v of props.members) m[v.userId] = v
  return m
})

const dated = computed(() =>
  props.tasks
    .filter(t => t.dueDate)
    .slice()
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
)

const groups = computed(() => {
  const out: Array<{ key: string, label: string, tasks: Task[] }> = []
  const index = new Map<string, number>()
  for (const t of dated.value) {
    const d = dueLocalDay(t.dueDate!)
    const key = dayKey(d)
    let i = index.get(key)
    if (i === undefined) {
      i = out.length
      index.set(key, i)
      out.push({
        key,
        label: d.toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'long' }),
        tasks: [],
      })
    }
    out[i]!.tasks.push(t)
  }
  return out
})

const selectedLabel = computed(() =>
  props.selectedDay
    ? props.selectedDay.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
    : null,
)

function primaryMember(t: Task): MemberView | null {
  const id = t.assigneeIds[0]
  return id ? membersById.value[id] ?? null : null
}
</script>

<template>
  <div class="flex flex-col lg:min-h-0 gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-base sm:text-lg font-semibold mr-auto">Дедлайны</h2>
      <CalendarFilters
        :members="members"
        :model-value="filters"
        @update:model-value="emit('update:filters', $event)"
      />
      <UButton size="sm" icon="i-lucide-plus" @click="emit('create')">
        Добавить
      </UButton>
    </div>

    <div v-if="selectedLabel" class="flex">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full bg-elevated text-xs text-default hover:bg-accented transition-colors"
        @click="emit('clear-day')"
      >
        <UIcon name="i-lucide-calendar" class="size-3.5 text-muted" />
        <span class="capitalize">{{ selectedLabel }}</span>
        <UIcon name="i-lucide-x" class="size-3.5 text-muted" />
      </button>
    </div>

    <div
      v-if="groups.length === 0"
      class="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12"
    >
      <UIcon name="i-lucide-calendar-check-2" class="size-10 text-dimmed" />
      <p class="text-sm text-muted">Нет задач с дедлайном</p>
      <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-plus" @click="emit('create')">
        Добавить задачу
      </UButton>
    </div>

    <div v-else class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex flex-col gap-4 pr-1">
      <div v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
        <p class="text-xs uppercase tracking-wide text-muted capitalize px-1">{{ g.label }}</p>
        <CalendarAgendaItem
          v-for="t in g.tasks"
          :key="t.id"
          :task="t"
          :member="primaryMember(t)"
          :column-name="columnsById[t.columnId] ?? null"
          @open="emit('open-task', $event)"
        />
      </div>
    </div>
  </div>
</template>
