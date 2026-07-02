<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
  taskTitle: string
  taskStoryPoints?: number | null
}>()

const open = defineModel<boolean>('open', { default: false })

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)

const { list: sprintsQuery } = useSprintsApi(wsId, bId)
const { memberships, addTo, removeFrom } = useTaskSprintMembership(
  wsId,
  bId,
  computed(() => props.taskId),
)
const { loadBySprintId } = useSprintLoads(wsId, bId)
const toast = useToast()

const memberIds = computed(() => new Set(memberships.value.map(s => s.id)))
const openSprints = computed(() =>
  (sprintsQuery.data.value?.sprints ?? []).filter(s => s.state !== 'closed'),
)

const groups = computed(() =>
  [
    { label: 'Активный', items: openSprints.value.filter(s => s.state === 'active') },
    { label: 'Запланированные', items: openSprints.value.filter(s => s.state === 'planned') },
  ].filter(g => g.items.length > 0),
)

const selectedId = ref<string | null>(null)
watch(open, (v) => {
  if (!v) selectedId.value = null
})

const selectedSprint = computed(() =>
  openSprints.value.find(s => s.id === selectedId.value) ?? null,
)

function loadOf(sprintId: string) {
  return loadBySprintId.value.get(sprintId) ?? { taskCount: 0, committedSp: 0 }
}

function loadPct(s: Sprint): number {
  if (s.capacity == null || s.capacity <= 0) return 0
  return Math.min(100, Math.round((loadOf(s.id).committedSp / s.capacity) * 100))
}

function isOver(s: Sprint): boolean {
  return s.capacity != null && loadOf(s.id).committedSp > s.capacity
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function sprintWindow(s: Sprint): string | null {
  const start = s.startedAt ?? s.plannedStartAt
  const end = s.plannedEndAt
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`
  if (start) return `с ${fmtDate(start)}`
  if (end) return `до ${fmtDate(end)}`
  return null
}

function loadLabel(s: Sprint): string {
  const l = loadOf(s.id)
  const sp = s.capacity != null ? `${l.committedSp}/${s.capacity} SP` : `${l.committedSp} SP`
  return `${sp} · ${l.taskCount} ${plural(l.taskCount, ['задача', 'задачи', 'задач'])}`
}

const projected = computed(() => {
  const s = selectedSprint.value
  if (!s) return null
  const l = loadOf(s.id)
  const sp = l.committedSp + (props.taskStoryPoints ?? 0)
  return {
    sp,
    capacity: s.capacity,
    over: s.capacity != null && sp > s.capacity,
  }
})

async function confirmAdd() {
  const s = selectedSprint.value
  if (!s) return
  try {
    await addTo.mutateAsync(s.id)
    toast.add({
      title: `Добавлена в спринт «${s.name}»`,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 3000,
    })
    open.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить в спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onRemove(sprintId: string) {
  try {
    await removeFrom.mutateAsync(sprintId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось убрать из спринта'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-xl' }">
    <template #content>
      <div class="flex items-start gap-3 p-4 sm:p-5 border-b border-default">
        <span class="inline-flex size-9 items-center justify-center rounded-lg bg-primary shrink-0">
          <UIcon name="i-lucide-iteration-ccw" class="size-4 text-accent-500" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold text-default tracking-tight">
            Добавить в спринт
          </h3>
          <p class="text-xs text-muted mt-0.5 truncate">
            Задача · <span class="text-default font-medium">{{ taskTitle }}</span>
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="soft"
          class="shrink-0"
          @click="open = false"
        />
      </div>

      <div class="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
        <div v-if="memberships.length > 0">
          <p class="text-xs font-semibold text-default uppercase tracking-wide mb-2">
            Сейчас в спринте
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="s in memberships"
              :key="s.id"
              class="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg bg-elevated text-[12.5px] text-default"
            >
              <span
                class="size-1.5 rounded-full shrink-0"
                :class="s.state === 'active' ? 'bg-emerald-500' : 'bg-accented'"
              />
              {{ s.name }}
              <button
                type="button"
                class="size-5 rounded grid place-items-center text-dimmed hover:bg-accented hover:text-default cursor-pointer transition-colors"
                title="Убрать из спринта"
                :disabled="removeFrom.isPending.value"
                @click="onRemove(s.id)"
              >
                <UIcon name="i-lucide-x" class="size-3" />
              </button>
            </span>
          </div>
        </div>

        <div
          v-if="openSprints.length === 0"
          class="flex items-start gap-3 p-3 rounded-lg border border-dashed border-default bg-elevated/40"
        >
          <UIcon name="i-lucide-iteration-ccw" class="size-4 text-muted shrink-0 mt-0.5" />
          <p class="text-xs text-muted leading-relaxed m-0">
            На доске нет незакрытых спринтов. Создайте спринт во вкладке «Спринты» — и сможете добавить задачу сюда.
          </p>
        </div>

        <div v-for="g in groups" :key="g.label">
          <p class="text-xs font-semibold text-default uppercase tracking-wide mb-2">
            {{ g.label }}
          </p>
          <div class="flex flex-col gap-2">
            <button
              v-for="s in g.items"
              :key="s.id"
              type="button"
              class="w-full flex items-start gap-2.5 p-3 rounded-lg border-[1.5px] text-left transition-colors"
              :class="memberIds.has(s.id)
                ? 'border-default bg-elevated/40 cursor-default'
                : selectedId === s.id
                  ? 'border-accent-500 bg-accent-50/60 dark:bg-accent-950/40 cursor-pointer'
                  : 'border-default bg-default hover:border-accent-300 dark:hover:border-accent-700 cursor-pointer'"
              :disabled="memberIds.has(s.id)"
              @click="selectedId = s.id"
            >
              <span
                v-if="memberIds.has(s.id)"
                class="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500 mt-0.5 shrink-0"
              >
                <UIcon name="i-lucide-check" class="size-3 text-white" />
              </span>
              <span
                v-else
                class="inline-flex size-4 items-center justify-center rounded-full border-2 mt-0.5 shrink-0 transition-colors"
                :class="selectedId === s.id ? 'border-accent-500' : 'border-neutral-400'"
              >
                <span v-if="selectedId === s.id" class="size-2 rounded-full bg-accent-500" />
              </span>

              <span class="flex-1 min-w-0">
                <span class="flex items-center gap-2 mb-0.5 min-w-0">
                  <span class="text-sm font-semibold text-default truncate">{{ s.name }}</span>
                  <SprintStateBadge :state="s.state" />
                  <span v-if="memberIds.has(s.id)" class="text-[10.5px] text-muted shrink-0">уже добавлена</span>
                </span>
                <span
                  v-if="s.goal"
                  class="block text-[11.5px] text-muted leading-snug line-clamp-2 mb-1.5"
                >
                  {{ s.goal }}
                </span>
                <span class="flex items-center gap-2.5 text-[11px] text-muted tabular-nums">
                  <span v-if="sprintWindow(s)" class="shrink-0">{{ sprintWindow(s) }}</span>
                  <span class="shrink-0">{{ loadLabel(s) }}</span>
                  <span
                    v-if="s.capacity != null && s.capacity > 0"
                    class="flex-1 max-w-[110px] h-1 rounded-full bg-accented overflow-hidden"
                  >
                    <span
                      class="block h-full rounded-full"
                      :class="isOver(s) ? 'bg-red-500' : 'bg-emerald-500'"
                      :style="{ width: `${loadPct(s)}%` }"
                    />
                  </span>
                  <span v-if="isOver(s)" class="text-red-600 dark:text-red-400 font-semibold shrink-0">перегружен</span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 p-4 border-t border-default sm:flex-row sm:items-center sm:gap-2">
        <p class="text-xs text-muted sm:flex-1">
          <template v-if="!selectedSprint">
            Выберите спринт из списка
          </template>
          <template v-else-if="projected">
            Попадёт в <span class="text-default font-semibold">«{{ selectedSprint.name }}»</span>
            <template v-if="projected.capacity != null">
              · станет <span class="font-semibold" :class="projected.over ? 'text-red-600 dark:text-red-400' : 'text-default'">{{ projected.sp }}/{{ projected.capacity }} SP</span>
              <span v-if="projected.over" class="text-red-600 dark:text-red-400 font-semibold"> — перегруз</span>
            </template>
            <template v-else>
              · станет <span class="text-default font-semibold">{{ projected.sp }} SP</span>
            </template>
          </template>
        </p>
        <div class="flex items-center justify-end gap-2 sm:shrink-0">
          <UButton variant="soft" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton
            icon="i-lucide-plus"
            :disabled="!selectedId"
            :loading="addTo.isPending.value"
            @click="confirmAdd"
          >
            Добавить
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
