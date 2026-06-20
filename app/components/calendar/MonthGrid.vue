<script setup lang="ts">
import type { Task } from '#shared/types/task'

const props = defineProps<{
  anchor: Date
  selectedDay: Date | null
  tasksByDay: Map<string, Task[]>
}>()

const emit = defineEmits<{
  'update:anchor': [value: Date]
  'select-day': [value: Date | null]
  reschedule: [payload: { taskId: string, day: Date }]
}>()

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const today = new Date()

const monthName = computed(() => props.anchor.toLocaleDateString('ru', { month: 'long' }))

const cells = computed(() =>
  monthGridDays(props.anchor).map((day) => {
    const tasks = props.tasksByDay.get(dayKey(day)) ?? []
    return {
      day,
      inMonth: day.getMonth() === props.anchor.getMonth(),
      isToday: sameDay(day, today),
      isSelected: !!props.selectedDay && sameDay(day, props.selectedDay),
      dotClasses: tasks.slice(0, 3).map(t => SERVICE_CLASS_INFO[t.serviceClass].dotClass),
      extraCount: Math.max(0, tasks.length - 3),
      hasOverdue: tasks.some(t => !t.closedAt && !!t.dueDate && dueDayInfo(t.dueDate).tone === 'overdue'),
    }
  }),
)

function onSelect(day: Date) {
  if (props.selectedDay && sameDay(day, props.selectedDay)) emit('select-day', null)
  else emit('select-day', day)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-base sm:text-lg font-semibold mr-auto flex items-baseline gap-1.5">
        <span class="capitalize">{{ monthName }}</span>
        <span class="text-muted font-normal">{{ anchor.getFullYear() }}</span>
      </h2>
      <UButton
        icon="i-lucide-chevron-left"
        size="sm"
        variant="ghost"
        color="neutral"
        @click="emit('update:anchor', addMonths(anchor, -1))"
      />
      <UButton
        size="sm"
        variant="soft"
        color="neutral"
        @click="emit('update:anchor', startOfMonth(new Date()))"
      >
        Сегодня
      </UButton>
      <UButton
        icon="i-lucide-chevron-right"
        size="sm"
        variant="ghost"
        color="neutral"
        @click="emit('update:anchor', addMonths(anchor, 1))"
      />
    </div>

    <div class="grid grid-cols-7 gap-1">
      <div
        v-for="d in WEEKDAYS"
        :key="d"
        class="text-center text-[11px] uppercase tracking-wide text-muted py-1"
      >
        {{ d }}
      </div>
      <CalendarDayCell
        v-for="c in cells"
        :key="dayKey(c.day)"
        :date="c.day"
        :in-month="c.inMonth"
        :is-today="c.isToday"
        :is-selected="c.isSelected"
        :dot-classes="c.dotClasses"
        :extra-count="c.extraCount"
        :has-overdue="c.hasOverdue"
        @select="onSelect(c.day)"
        @drop-task="(taskId: string) => emit('reschedule', { taskId, day: c.day })"
      />
    </div>
  </div>
</template>
