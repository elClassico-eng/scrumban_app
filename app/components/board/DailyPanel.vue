<script setup lang="ts">
import type { DailyChangeKind, DailyStat } from '#shared/types/daily'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { digest } = useDailyDigestApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
  open,
)

const d = computed(() => digest.data.value ?? null)

function statTone(key: 'done' | 'wip' | 'blocked' | 'aging', delta: number): string {
  if (delta === 0) return 'text-muted'
  const goodUp = key === 'done'
  const improved = goodUp ? delta > 0 : delta < 0
  return improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
}

function deltaLabel(delta: number): string {
  if (delta === 0) return '±0'
  return delta > 0 ? `+${delta}` : `${delta}`
}

const STAT_META: { key: 'done' | 'wip' | 'blocked' | 'aging'; label: string; icon: string; get: (s: DailyStat) => number }[] = [
  { key: 'done', label: 'Done', icon: 'i-lucide-check-circle-2', get: s => s.value },
  { key: 'wip', label: 'WIP', icon: 'i-lucide-loader', get: s => s.value },
  { key: 'blocked', label: 'Blocked', icon: 'i-lucide-octagon-x', get: s => s.value },
  { key: 'aging', label: 'Aging', icon: 'i-lucide-hourglass', get: s => s.value },
]

const CHANGE_LABEL: Record<DailyChangeKind, string> = {
  closed: 'Закрыто',
  moved: 'Перемещено',
  blocked: 'Заблокировано',
  unblocked: 'Разблокировано',
  added_to_sprint: 'В спринт',
  removed_from_sprint: 'Из спринта',
}

const changeSummary = computed(() => {
  if (!d.value) return []
  return (Object.keys(CHANGE_LABEL) as DailyChangeKind[])
    .filter(k => d.value!.changes[k] > 0)
    .map(k => ({ label: CHANGE_LABEL[k], count: d.value!.changes[k] }))
})

function heatCell(n: number, tone: 'fresh' | 'approaching' | 'overdue'): string {
  if (n === 0) return 'bg-elevated/40 text-dimmed'
  if (tone === 'overdue') return 'bg-red-500/15 text-red-600 dark:text-red-300 font-semibold'
  if (tone === 'approaching') return 'bg-accent-500/15 text-accent-700 dark:text-accent-300 font-semibold'
  return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-medium'
}

function openTask(taskId: string) {
  open.value = false
  navigateTo(pageRoutes.task(props.workspaceId, props.boardId, taskId))
}
</script>

<template>
  <USlideover v-model:open="open" title="Дейли" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div v-if="digest.isLoading.value" class="text-[12.5px] text-muted py-6 text-center">
        Собираем повестку дня…
      </div>

      <div v-else-if="d" class="space-y-5">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div
            v-for="m in STAT_META"
            :key="m.key"
            class="bg-default border border-default rounded-xl px-3 py-2.5"
          >
            <div class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted inline-flex items-center gap-1">
              <UIcon :name="m.icon" class="size-3" />
              {{ m.label }}
            </div>
            <div class="flex items-baseline gap-1.5 mt-0.5">
              <span class="text-[22px] font-semibold tracking-tight text-default tabular-nums">{{ m.get(d.stats[m.key]) }}</span>
              <span class="text-[12px] font-semibold tabular-nums" :class="statTone(m.key, d.stats[m.key].delta)">
                {{ deltaLabel(d.stats[m.key].delta) }}
              </span>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-dimmed -mt-3">Числа в скобках — динамика к предыдущим суткам.</p>

        <section v-if="d.aging.length > 0" class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-hourglass" class="size-3.5 text-accent-600" />
            Aging WIP
            <span class="text-dimmed font-normal normal-case">старше P85 = {{ d.p85Days }} дн</span>
          </div>
          <div class="border border-default rounded-xl overflow-hidden divide-y divide-default">
            <button
              v-for="t in d.aging"
              :key="t.taskId"
              type="button"
              class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-elevated/60 transition-colors cursor-pointer"
              @click="openTask(t.taskId)"
            >
              <span class="flex-1 min-w-0 truncate text-[13px] text-default">{{ t.title }}</span>
              <span class="shrink-0 text-[11px] text-muted">{{ t.columnName }}</span>
              <span class="shrink-0 text-[11px] font-semibold text-red-500 tabular-nums">+{{ t.overP85Days }} дн</span>
            </button>
          </div>
        </section>

        <section v-if="d.heatmap.length > 0" class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Aging heatmap</div>
          <div class="border border-default rounded-xl overflow-hidden">
            <div class="grid grid-cols-[1fr_auto_auto_auto] text-[11px]">
              <div class="px-3 py-1.5 text-dimmed font-medium">Колонка</div>
              <div class="px-2.5 py-1.5 text-center text-emerald-600 font-medium w-14">Свежие</div>
              <div class="px-2.5 py-1.5 text-center text-accent-600 font-medium w-14">К P85</div>
              <div class="px-2.5 py-1.5 text-center text-red-500 font-medium w-14">Старые</div>
              <template v-for="row in d.heatmap" :key="row.columnId">
                <div class="px-3 py-1.5 border-t border-default truncate text-default">{{ row.columnName }}</div>
                <div class="border-t border-default p-1">
                  <div class="rounded h-6 grid place-items-center tabular-nums" :class="heatCell(row.fresh, 'fresh')">{{ row.fresh }}</div>
                </div>
                <div class="border-t border-default p-1">
                  <div class="rounded h-6 grid place-items-center tabular-nums" :class="heatCell(row.approaching, 'approaching')">{{ row.approaching }}</div>
                </div>
                <div class="border-t border-default p-1">
                  <div class="rounded h-6 grid place-items-center tabular-nums" :class="heatCell(row.overdue, 'overdue')">{{ row.overdue }}</div>
                </div>
              </template>
            </div>
          </div>
        </section>

        <section v-if="d.blockers.length > 0" class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-octagon-x" class="size-3.5 text-red-500" />
            Блокеры
          </div>
          <div class="border border-default rounded-xl overflow-hidden divide-y divide-default">
            <button
              v-for="b in d.blockers"
              :key="b.taskId"
              type="button"
              class="w-full text-left px-3 py-2 hover:bg-elevated/60 transition-colors cursor-pointer"
              @click="openTask(b.taskId)"
            >
              <div class="flex items-center gap-2.5">
                <span class="flex-1 min-w-0 truncate text-[13px] text-default">{{ b.title }}</span>
                <span class="shrink-0 text-[11px] font-semibold text-red-500 tabular-nums">{{ b.blockedDays }} дн в блоке</span>
              </div>
              <p v-if="b.reason" class="text-[11.5px] text-muted mt-0.5 m-0 truncate">{{ b.reason }}</p>
            </button>
          </div>
        </section>

        <section v-if="d.wipViolations.length > 0 || d.sprintRisk" class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Риски</div>
          <div class="space-y-1.5">
            <div
              v-for="v in d.wipViolations"
              :key="v.columnId"
              class="flex items-center gap-2 text-[12.5px] border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2"
            >
              <UIcon name="i-lucide-layers" class="size-3.5 text-red-500 shrink-0" />
              <span class="flex-1 text-red-800 dark:text-red-200">«{{ v.columnName }}» превышает WIP-лимит</span>
              <span class="font-semibold text-red-600 dark:text-red-300 tabular-nums">{{ v.count }}/{{ v.limit }}</span>
            </div>
            <div
              v-if="d.sprintRisk && d.sprintRisk.atRisk.length > 0"
              class="border border-accent-200 dark:border-accent-900 bg-accent-50 dark:bg-accent-950 rounded-lg px-3 py-2 space-y-1"
            >
              <div class="text-[12px] font-semibold text-accent-800 dark:text-accent-200 inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-flag-triangle-right" class="size-3.5" />
                Рискуют не успеть в спринте «{{ d.sprintRisk.sprintName }}»
                <span v-if="d.sprintRisk.horizonDays !== null" class="font-normal">· осталось {{ d.sprintRisk.horizonDays }} дн</span>
              </div>
              <button
                v-for="r in d.sprintRisk.atRisk"
                :key="r.taskId"
                type="button"
                class="block w-full text-left text-[12px] text-accent-900 dark:text-accent-100 hover:underline cursor-pointer truncate"
                @click="openTask(r.taskId)"
              >
                {{ r.title }} · {{ r.ageDays }} дн в работе
              </button>
            </div>
          </div>
        </section>

        <section class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Что изменилось за 24 часа</div>
          <div v-if="changeSummary.length > 0" class="flex flex-wrap gap-1.5">
            <span
              v-for="c in changeSummary"
              :key="c.label"
              class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-muted"
            >
              {{ c.label }}: <b class="text-default">{{ c.count }}</b>
            </span>
          </div>
          <div v-if="d.changeItems.length > 0" class="border border-default rounded-xl overflow-hidden divide-y divide-default max-h-64 overflow-y-auto">
            <button
              v-for="(c, i) in d.changeItems"
              :key="i"
              type="button"
              class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-elevated/60 transition-colors cursor-pointer text-[12.5px]"
              @click="openTask(c.taskId)"
            >
              <span class="shrink-0 text-[10.5px] text-muted w-24">{{ CHANGE_LABEL[c.kind] }}</span>
              <span class="flex-1 min-w-0 truncate text-default">{{ c.title }}</span>
            </button>
          </div>
          <p v-else class="text-[12px] text-dimmed">За сутки на доске без движения.</p>
        </section>
      </div>
    </template>
  </USlideover>
</template>
