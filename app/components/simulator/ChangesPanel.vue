<script setup lang="ts">
import type { SprintNetworkReport } from '#shared/types/network'
import type { ScenarioChange } from '#shared/types/scenario'

const props = defineProps<{
  baseline: Extract<SprintNetworkReport, { ok: true }>
  horizonDays: number | null
}>()

const draft = defineModel<ScenarioChange[]>('draft', { required: true })

const titleById = computed(() => {
  const m = new Map<string, string>()
  for (const t of props.baseline.tasks) m.set(t.taskId, t.title)
  return m
})

const excludedIds = computed(() => new Set(
  draft.value.filter(c => c.type === 'exclude_task').map(c => c.taskId),
))

function reestimateFor(taskId: string): number | null {
  const c = draft.value.find(x => x.type === 'reestimate_task' && x.taskId === taskId)
  return c && c.type === 'reestimate_task' ? c.estimateDays : null
}

function toggleExclude(taskId: string) {
  if (excludedIds.value.has(taskId)) {
    draft.value = draft.value.filter(c => !(c.type === 'exclude_task' && c.taskId === taskId))
  }
  else {
    draft.value = [
      ...draft.value.filter(c => !('taskId' in c && c.taskId === taskId)),
      { type: 'exclude_task', taskId },
    ]
  }
}

function setReestimate(taskId: string, raw: string) {
  const days = Number(raw)
  const rest = draft.value.filter(c => !(c.type === 'reestimate_task' && c.taskId === taskId))
  if (!raw || Number.isNaN(days) || days <= 0) {
    draft.value = rest
    return
  }
  draft.value = [...rest, { type: 'reestimate_task', taskId, estimateDays: days }]
}

type EdgeView = { blockerTaskId: string; blockedTaskId: string; removed: boolean }

const edges = computed<EdgeView[]>(() => {
  const removedKeys = new Set(
    draft.value
      .filter(c => c.type === 'remove_dependency')
      .map(c => c.type === 'remove_dependency' ? `${c.blockerTaskId}->${c.blockedTaskId}` : ''),
  )
  const base: EdgeView[] = props.baseline.tasks.flatMap(t =>
    t.dependsOn.map(blockerId => ({
      blockerTaskId: blockerId,
      blockedTaskId: t.taskId,
      removed: removedKeys.has(`${blockerId}->${t.taskId}`),
    })),
  )
  const added: EdgeView[] = draft.value
    .filter(c => c.type === 'add_dependency')
    .map(c => c.type === 'add_dependency'
      ? { blockerTaskId: c.blockerTaskId, blockedTaskId: c.blockedTaskId, removed: false }
      : { blockerTaskId: '', blockedTaskId: '', removed: false })
  return [...base, ...added]
})

function isAddedEdge(e: EdgeView): boolean {
  return draft.value.some(c =>
    c.type === 'add_dependency' && c.blockerTaskId === e.blockerTaskId && c.blockedTaskId === e.blockedTaskId)
}

function toggleEdgeRemoval(e: EdgeView) {
  if (isAddedEdge(e)) {
    draft.value = draft.value.filter(c =>
      !(c.type === 'add_dependency' && c.blockerTaskId === e.blockerTaskId && c.blockedTaskId === e.blockedTaskId))
    return
  }
  if (e.removed) {
    draft.value = draft.value.filter(c =>
      !(c.type === 'remove_dependency' && c.blockerTaskId === e.blockerTaskId && c.blockedTaskId === e.blockedTaskId))
  }
  else {
    draft.value = [...draft.value, {
      type: 'remove_dependency',
      blockerTaskId: e.blockerTaskId,
      blockedTaskId: e.blockedTaskId,
    }]
  }
}

const newBlockerId = ref<string | undefined>(undefined)
const newBlockedId = ref<string | undefined>(undefined)

const taskOptions = computed(() =>
  props.baseline.tasks
    .filter(t => !excludedIds.value.has(t.taskId))
    .map(t => ({ label: t.title, value: t.taskId })),
)

const canAddEdge = computed(() =>
  !!newBlockerId.value && !!newBlockedId.value && newBlockerId.value !== newBlockedId.value)

function addEdge() {
  if (!canAddEdge.value) return
  draft.value = [...draft.value, {
    type: 'add_dependency',
    blockerTaskId: newBlockerId.value!,
    blockedTaskId: newBlockedId.value!,
  }]
  newBlockerId.value = undefined
  newBlockedId.value = undefined
}

const deadlineShift = computed<number>({
  get() {
    const c = draft.value.find(x => x.type === 'shift_deadline')
    return c && c.type === 'shift_deadline' ? c.days : 0
  },
  set(value: number) {
    const rest = draft.value.filter(c => c.type !== 'shift_deadline')
    const days = Math.max(-90, Math.min(90, Math.round(value || 0)))
    draft.value = days === 0 ? rest : [...rest, { type: 'shift_deadline', days }]
  },
})
</script>

<template>
  <div class="bg-default border border-default rounded-2xl px-5 py-5 space-y-5">
    <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0 inline-flex items-center gap-1.5">
      <UIcon name="i-lucide-sliders-horizontal" class="size-3.5" />
      Изменения сценария
    </h4>

    <div class="space-y-1.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Задачи спринта</div>
      <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
        <div
          v-for="t in baseline.tasks"
          :key="t.taskId"
          class="px-3 py-2 space-y-1"
          :class="excludedIds.has(t.taskId) ? 'opacity-50' : ''"
        >
          <div class="flex items-center gap-2">
            <span
              class="size-1.5 rounded-full shrink-0"
              :class="t.critical ? 'bg-accent-500' : 'bg-zinc-300 dark:bg-zinc-600'"
            />
            <span
              class="truncate text-[12.5px] text-default"
              :class="excludedIds.has(t.taskId) ? 'line-through' : ''"
            >{{ t.title }}</span>
            <div class="flex-1" />
            <UTooltip :text="excludedIds.has(t.taskId) ? 'Вернуть в сценарий' : 'Исключить из спринта'">
              <UButton
                size="xs"
                variant="ghost"
                :color="excludedIds.has(t.taskId) ? 'primary' : 'neutral'"
                :icon="excludedIds.has(t.taskId) ? 'i-lucide-undo-2' : 'i-lucide-x'"
                @click="toggleExclude(t.taskId)"
              />
            </UTooltip>
          </div>
          <div v-if="!excludedIds.has(t.taskId)" class="flex items-center gap-2 pl-3.5">
            <span class="text-[11px] text-muted">оценка ~{{ t.expectedDays }} дн →</span>
            <UInput
              :model-value="reestimateFor(t.taskId) ?? undefined"
              type="number"
              size="xs"
              step="0.5"
              min="0.5"
              max="365"
              :placeholder="String(t.estimate.mostLikelyDays)"
              class="w-20"
              @update:model-value="setReestimate(t.taskId, String($event ?? ''))"
            />
            <span class="text-[11px] text-muted">дн</span>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Зависимости</div>
      <div v-if="edges.length === 0" class="text-[12px] text-dimmed">
        В спринте нет зависимостей между открытыми задачами.
      </div>
      <div v-else class="border border-default rounded-lg overflow-hidden divide-y divide-default">
        <div
          v-for="e in edges"
          :key="`${e.blockerTaskId}->${e.blockedTaskId}`"
          class="flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          :class="e.removed ? 'opacity-50' : ''"
        >
          <span class="truncate max-w-[38%] text-default" :class="e.removed ? 'line-through' : ''">
            {{ titleById.get(e.blockerTaskId) ?? '…' }}
          </span>
          <UIcon name="i-lucide-arrow-right" class="size-3 text-dimmed shrink-0" />
          <span class="truncate max-w-[38%] text-default" :class="e.removed ? 'line-through' : ''">
            {{ titleById.get(e.blockedTaskId) ?? '…' }}
          </span>
          <span
            v-if="isAddedEdge(e)"
            class="text-[10px] font-semibold uppercase px-1 py-px rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
          >новая</span>
          <div class="flex-1" />
          <UTooltip :text="isAddedEdge(e) ? 'Убрать добавленную' : (e.removed ? 'Вернуть зависимость' : 'Разорвать зависимость')">
            <UButton
              size="xs"
              variant="ghost"
              :color="e.removed ? 'primary' : 'neutral'"
              :icon="e.removed ? 'i-lucide-undo-2' : 'i-lucide-scissors'"
              @click="toggleEdgeRemoval(e)"
            />
          </UTooltip>
        </div>
      </div>

      <div class="flex items-center gap-1.5 pt-1">
        <USelect
          v-model="newBlockerId"
          :items="taskOptions"
          value-key="value"
          placeholder="Блокирует…"
          size="xs"
          class="flex-1 min-w-0"
        />
        <UIcon name="i-lucide-arrow-right" class="size-3 text-dimmed shrink-0" />
        <USelect
          v-model="newBlockedId"
          :items="taskOptions"
          value-key="value"
          placeholder="…задачу"
          size="xs"
          class="flex-1 min-w-0"
        />
        <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-plus" :disabled="!canAddEdge" @click="addEdge" />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Дедлайн спринта</div>
      <div class="flex items-center gap-2">
        <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-minus" @click="deadlineShift = deadlineShift - 1" />
        <span class="text-[13px] font-semibold tabular-nums text-default min-w-16 text-center">
          {{ deadlineShift > 0 ? `+${deadlineShift}` : deadlineShift }} дн
        </span>
        <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-plus" @click="deadlineShift = deadlineShift + 1" />
        <span v-if="horizonDays !== null" class="text-[11px] text-muted ml-1">
          горизонт: {{ Math.round((horizonDays + deadlineShift) * 10) / 10 }} дн
        </span>
      </div>
    </div>
  </div>
</template>
