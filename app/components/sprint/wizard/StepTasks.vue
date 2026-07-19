<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { SprintPreviewRisk } from '#shared/types/sprint'

const props = defineProps<{
  candidates: Task[]
  allTasks: Task[]
  capacity: number | null
  externalRisks: SprintPreviewRisk[]
}>()

const selected = defineModel<Set<string>>({ required: true })

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.candidates
  return props.candidates.filter(t => t.title.toLowerCase().includes(q))
})

const taskById = computed(() => {
  const m = new Map<string, Task>()
  for (const t of props.allTasks) m.set(t.id, t)
  return m
})

function toggle(taskId: string) {
  const next = new Set(selected.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  selected.value = next
}

const selectedTasks = computed(() =>
  [...selected.value].map(id => taskById.value.get(id)).filter((t): t is Task => !!t),
)

const committedSp = computed(() =>
  selectedTasks.value.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0),
)

const loadRatio = computed(() => {
  if (!props.capacity || props.capacity === 0) return null
  return committedSp.value / props.capacity
})

const externalWarnings = computed(() => {
  const seen = new Set<string>()
  const out: { taskId: string; taskTitle: string; blockerTaskId: string; blockerTitle: string }[] = []
  for (const r of props.externalRisks) {
    if (r.type !== 'external_dependency') continue
    const key = `${r.taskId}->${r.blockerTaskId}`
    if (seen.has(key) || selected.value.has(r.blockerTaskId)) continue
    seen.add(key)
    out.push({
      taskId: r.taskId,
      taskTitle: taskById.value.get(r.taskId)?.title ?? '…',
      blockerTaskId: r.blockerTaskId,
      blockerTitle: r.blockerTitle,
    })
  }
  return out
})

function addBlocker(blockerTaskId: string) {
  const next = new Set(selected.value)
  next.add(blockerTaskId)
  selected.value = next
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <UInput
        v-model="query"
        size="lg"
        icon="i-lucide-search"
        placeholder="Найти задачу в бэклоге…"
        class="flex-1"
      />
      <span class="text-[13px] text-muted tabular-nums shrink-0">
        выбрано <b class="text-default">{{ selected.size }}</b> · {{ committedSp }} SP
      </span>
    </div>

    <div v-if="capacity" class="space-y-1.5">
      <div class="flex items-center justify-between text-[12px]">
        <span class="text-muted">Нагрузка</span>
        <span
          class="font-semibold tabular-nums"
          :class="loadRatio !== null && loadRatio > 1 ? 'text-red-500' : 'text-default'"
        >
          {{ committedSp }} / {{ capacity }} SP
          <template v-if="loadRatio !== null"> · {{ Math.round(loadRatio * 100) }}%</template>
        </span>
      </div>
      <div class="h-2 rounded-full bg-elevated overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="loadRatio !== null && loadRatio > 1 ? 'bg-red-500' : 'bg-accent-500'"
          :style="{ width: `${Math.min(100, (loadRatio ?? 0) * 100)}%` }"
        />
      </div>
      <p v-if="loadRatio !== null && loadRatio > 1" class="text-[11.5px] text-red-500 m-0">
        Состав превышает вместимость команды — подумайте, что отложить.
      </p>
    </div>

    <div
      v-if="externalWarnings.length > 0"
      class="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 rounded-xl px-4 py-3 space-y-2"
    >
      <div class="text-[12px] font-semibold text-amber-800 dark:text-amber-200 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
        Внешние зависимости
      </div>
      <div
        v-for="w in externalWarnings"
        :key="`${w.taskId}-${w.blockerTaskId}`"
        class="flex items-center gap-2 text-[12.5px] text-amber-900 dark:text-amber-100"
      >
        <span class="min-w-0 flex-1">
          «{{ w.taskTitle }}» зависит от «{{ w.blockerTitle }}» вне состава
        </span>
        <UButton size="xs" variant="outline" color="neutral" @click="addBlocker(w.blockerTaskId)">
          Добавить блокер
        </UButton>
      </div>
    </div>

    <div class="border border-default rounded-xl overflow-hidden">
      <div class="max-h-[46vh] overflow-y-auto divide-y divide-default">
        <button
          v-for="t in filtered"
          :key="t.id"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-elevated/60"
          :class="selected.has(t.id) ? 'bg-accent-50/60 dark:bg-accent-950/40' : ''"
          @click="toggle(t.id)"
        >
          <UCheckbox
            :model-value="selected.has(t.id)"
            tabindex="-1"
            class="pointer-events-none"
          />
          <span class="flex-1 min-w-0 truncate text-[13.5px]" :class="selected.has(t.id) ? 'text-default font-medium' : 'text-default'">
            {{ t.title }}
          </span>
          <span
            v-if="t.storyPoints !== null"
            class="shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-elevated text-muted"
          >{{ t.storyPoints }} SP</span>
          <span
            v-else
            class="shrink-0 text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
          >без оценки</span>
        </button>

        <div v-if="filtered.length === 0" class="px-4 py-8 text-center text-[12.5px] text-muted">
          {{ candidates.length === 0 ? 'Бэклог пуст — все задачи уже в спринтах или закрыты.' : 'Ничего не найдено.' }}
        </div>
      </div>
    </div>
  </div>
</template>
