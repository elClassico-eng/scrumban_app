<script setup lang="ts">
import type { SprintNetworkReport } from '#shared/types/network'
import type { ScenarioChange, SprintScenario } from '#shared/types/scenario'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  boardId: string
  sprintId: string
  baseline: Extract<SprintNetworkReport, { ok: true }>
  draft: ScenarioChange[]
  loadedScenarioId: string | null
  canApply: boolean
}>()

const emit = defineEmits<{
  load: [scenario: SprintScenario]
  saved: [scenarioId: string]
  reset: []
}>()

const { scenarios, create, update, remove, apply } = useSprintScenariosApi(
  computed(() => props.wsId),
  computed(() => props.boardId),
  computed(() => props.sprintId),
)

const confirm = useConfirm()
const toast = useToast()

const titleById = computed(() => {
  const m = new Map<string, string>()
  for (const t of props.baseline.tasks) m.set(t.taskId, t.title)
  return m
})

function changeToHuman(c: ScenarioChange): string {
  const title = (id: string) => `«${titleById.value.get(id) ?? 'задача'}»`
  switch (c.type) {
    case 'exclude_task':
      return `Задача ${title(c.taskId)} будет убрана из спринта`
    case 'reestimate_task':
      return `Оценка ${title(c.taskId)} станет ${c.estimateDays} дн`
    case 'remove_dependency':
      return `Зависимость ${title(c.blockerTaskId)} → ${title(c.blockedTaskId)} будет удалена`
    case 'add_dependency':
      return `Зависимость ${title(c.blockerTaskId)} → ${title(c.blockedTaskId)} будет добавлена`
    case 'shift_deadline':
      return `Дедлайн спринта сдвинется на ${c.days > 0 ? `+${c.days}` : c.days} дн`
  }
}

function deltaSummary(s: SprintScenario): string | null {
  const base = s.baselineResult?.simulation.probabilityWithinHorizon
  const sc = s.scenarioResult?.simulation.probabilityWithinHorizon
  if (base === null || base === undefined || sc === null || sc === undefined) {
    const p50base = s.baselineResult?.simulation.p50Days
    const p50sc = s.scenarioResult?.simulation.p50Days
    if (p50base === undefined || p50sc === undefined) return null
    const d = Math.round((p50base - p50sc) * 10) / 10
    return `P50 ${d > 0 ? '−' : '+'}${Math.abs(d)} дн`
  }
  const pp = Math.round((sc - base) * 100)
  return `${pp > 0 ? '+' : ''}${pp} п.п. к вероятности`
}

function isStale(s: SprintScenario): boolean {
  if (!s.computedAt) return true
  return Date.now() - new Date(s.computedAt).getTime() > 24 * 3600_000
}

const saveName = ref('')
const savePopoverOpen = ref(false)

async function saveDraft() {
  if (props.draft.length === 0) return
  try {
    if (props.loadedScenarioId) {
      await update.mutateAsync({ scenarioId: props.loadedScenarioId, changes: [...props.draft] })
      toast.add({ title: 'Сценарий обновлён', color: 'success' })
      emit('saved', props.loadedScenarioId)
    }
    else {
      const name = saveName.value.trim() || `Сценарий ${new Date().toLocaleDateString('ru-RU')}`
      const res = await create.mutateAsync({ name, changes: [...props.draft] })
      toast.add({ title: `Сценарий «${res.scenario.name}» сохранён`, color: 'success' })
      emit('saved', res.scenario.id)
    }
    savePopoverOpen.value = false
    saveName.value = ''
  }
  catch (err) {
    toast.add({ title: 'Не удалось сохранить сценарий', description: errMessage(err), color: 'error' })
  }
}

async function recompute(s: SprintScenario) {
  try {
    await update.mutateAsync({ scenarioId: s.id, changes: [...s.changes] })
    toast.add({ title: 'Прогноз сценария пересчитан', color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Не удалось пересчитать', description: errMessage(err), color: 'error' })
  }
}

async function applyScenario(s: SprintScenario) {
  const ok = await confirm({
    title: `Применить сценарий «${s.name}»?`,
    description: `Изменения станут реальными:\n${s.changes.map(c => `• ${changeToHuman(c)}`).join('\n')}`,
    confirmLabel: 'Применить',
  })
  if (!ok) return
  try {
    await apply.mutateAsync(s.id)
    toast.add({ title: `Сценарий «${s.name}» применён`, color: 'success' })
    emit('reset')
    await navigateTo(pageRoutes.boardSprints(props.wsId, props.boardId))
  }
  catch (err) {
    toast.add({ title: 'Не удалось применить сценарий', description: errMessage(err), color: 'error' })
  }
}

async function removeScenario(s: SprintScenario) {
  const ok = await confirm({
    title: `Удалить сценарий «${s.name}»?`,
    description: 'Действие необратимо. Реальные данные спринта не пострадают.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(s.id)
    if (props.loadedScenarioId === s.id) emit('reset')
  }
  catch (err) {
    toast.add({ title: 'Не удалось удалить', description: errMessage(err), color: 'error' })
  }
}

function errMessage(err: unknown): string {
  const e = err as { data?: { message?: string }; message?: string }
  return e?.data?.message ?? e?.message ?? 'Неизвестная ошибка'
}

function menuItems(s: SprintScenario) {
  const items = [
    { label: 'Загрузить в черновик', icon: 'i-lucide-upload', onSelect: () => emit('load', s) },
    { label: 'Пересчитать прогноз', icon: 'i-lucide-refresh-cw', onSelect: () => recompute(s), disabled: !!s.appliedAt },
    { label: 'Удалить', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => removeScenario(s) },
  ]
  return [items]
}
</script>

<template>
  <div class="bg-default border border-default rounded-2xl px-5 py-5 space-y-3">
    <div class="flex items-center gap-2">
      <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-bookmark" class="size-3.5" />
        Сохранённые сценарии
      </h4>
      <div class="flex-1" />
      <UPopover v-if="!loadedScenarioId" v-model:open="savePopoverOpen">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-save"
          :disabled="draft.length === 0"
          :loading="create.isPending.value"
        >
          Сохранить черновик
        </UButton>
        <template #content>
          <div class="p-3 space-y-2 w-64">
            <UInput v-model="saveName" size="sm" placeholder="Название сценария" @keydown.enter="saveDraft" />
            <UButton size="xs" block :loading="create.isPending.value" @click="saveDraft">Сохранить</UButton>
          </div>
        </template>
      </UPopover>
      <UButton
        v-else
        size="xs"
        variant="outline"
        color="neutral"
        icon="i-lucide-save"
        :disabled="draft.length === 0"
        :loading="update.isPending.value"
        @click="saveDraft"
      >
        Обновить сценарий
      </UButton>
    </div>

    <div v-if="(scenarios.data.value ?? []).length === 0" class="text-[12px] text-dimmed">
      Пока нет сохранённых сценариев. Соберите изменения и сохраните черновик,
      чтобы вернуться к нему или показать команде.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      <div
        v-for="s in scenarios.data.value"
        :key="s.id"
        class="border rounded-xl px-3.5 py-3 space-y-1.5"
        :class="s.id === loadedScenarioId ? 'border-accent-500' : 'border-default'"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-[13px] font-semibold text-default truncate">{{ s.name }}</span>
          <span
            v-if="s.appliedAt"
            class="text-[10px] font-semibold uppercase px-1 py-px rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0"
          >применён</span>
          <div class="flex-1" />
          <UDropdownMenu :items="menuItems(s)">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-ellipsis-vertical" />
          </UDropdownMenu>
        </div>

        <div class="text-[11.5px] text-muted">
          {{ s.changes.length }} изменени{{ s.changes.length === 1 ? 'е' : (s.changes.length < 5 ? 'я' : 'й') }}
          <template v-if="deltaSummary(s)"> · <b class="text-default">{{ deltaSummary(s) }}</b></template>
        </div>

        <div class="text-[10.5px] text-dimmed tabular-nums flex items-center gap-1">
          <template v-if="s.computedAt">
            посчитан {{ new Date(s.computedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
          </template>
          <span
            v-if="isStale(s) && !s.appliedAt"
            class="text-[10px] font-semibold uppercase px-1 py-px rounded bg-elevated text-muted"
          >мог устареть</span>
        </div>

        <div v-if="canApply && !s.appliedAt" class="pt-1">
          <UButton
            size="xs"
            icon="i-lucide-check"
            :loading="apply.isPending.value"
            @click="applyScenario(s)"
          >
            Применить
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
