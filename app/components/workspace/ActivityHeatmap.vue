<script setup lang="ts">
import type { TaskEventType } from '#shared/types/domain'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  userId: string | null
  boardId?: string
  members: {
    userId: string
    email: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }[]
}>()

const ALL_ACTORS = '__all__'
const DAY_MS = 86_400_000

const PERIODS = [
  { value: 'year', label: 'Год', weeks: 52, cell: 13 },
  { value: 'quarter', label: '3 месяца', weeks: 13, cell: 26 },
  { value: 'month', label: 'Месяц', weeks: 5, cell: 34 },
] as const

type PeriodValue = (typeof PERIODS)[number]['value']

const period = ref<PeriodValue>('year')
const current = computed(() => PERIODS.find(p => p.value === period.value)!)
const WEEKS = computed(() => current.value.weeks)
const cell = computed(() => current.value.cell)
const gap = computed(() => (cell.value >= 26 ? 5 : 3))

const actor = ref<string>(props.userId ?? ALL_ACTORS)

const actorItems = computed(() => [
  { label: 'Вся команда', value: ALL_ACTORS, icon: 'i-lucide-users' },
  ...props.members.map(m => ({
    label: m.userId === props.userId ? `${displayName(m)} (вы)` : displayName(m),
    value: m.userId,
    avatar: {
      src: m.avatarUrl ?? undefined,
      alt: displayName(m),
      text: initials(m),
      ui: { root: 'shrink-0' },
    },
  })),
])

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const range = computed(() => {
  const today = startOfDay(new Date())
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - ((today.getDay() + 6) % 7)))
  const start = new Date(end)
  start.setDate(start.getDate() - (WEEKS.value * 7 - 1))
  return { start, end }
})

const filters = computed(() => ({
  from: range.value.start.toISOString(),
  to: new Date(range.value.end.getTime() + DAY_MS - 1).toISOString(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  board: props.boardId,
  actor: actor.value === ALL_ACTORS ? undefined : actor.value,
}))

const { list } = useActivityDailyApi(() => props.wsId, filters)
const buckets = computed(() => list.data.value?.buckets ?? [])

const byDay = computed(() => {
  const map = new Map<string, { count: number, types: Map<TaskEventType, number> }>()
  for (const b of buckets.value) {
    const entry = map.get(b.day) ?? { count: 0, types: new Map() }
    entry.count += b.count
    entry.types.set(b.eventType, (entry.types.get(b.eventType) ?? 0) + b.count)
    map.set(b.day, entry)
  }
  return map
})

const peak = computed(() => Math.max(0, ...[...byDay.value.values()].map(d => d.count)))
const total = computed(() => buckets.value.reduce((s, b) => s + b.count, 0))
const activeDays = computed(() => byDay.value.size)
const perWeek = computed(() =>
  total.value ? Math.round((total.value / WEEKS.value) * 10) / 10 : 0,
)

const bestDay = computed(() => {
  let best: { day: string, count: number } | null = null
  for (const [day, v] of byDay.value) {
    if (!best || v.count > best.count) best = { day, count: v.count }
  }
  return best
})

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function level(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (peak.value <= 1) return 4
  const r = count / peak.value
  if (r <= 0.25) return 1
  if (r <= 0.5) return 2
  if (r <= 0.75) return 3
  return 4
}

const columns = computed(() => {
  const today = startOfDay(new Date())
  const cols: { key: string, cells: { key: string, date: Date, count: number, future: boolean }[] }[] = []
  for (let w = 0; w < WEEKS.value; w++) {
    const cells = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(range.value.start)
      date.setDate(date.getDate() + w * 7 + d)
      const key = dayKeyLocal(date)
      cells.push({ key, date, count: byDay.value.get(key)?.count ?? 0, future: date > today })
    }
    cols.push({ key: cells[0]!.key, cells })
  }
  return cols
})

// The range spans two calendar years, so a bare "июль" appears twice and reads
// as the same month. The year is spelled out on the first label and whenever it
// rolls over.
const monthMarks = computed(() => {
  let lastYear: number | null = null
  return columns.value.map((col, i) => {
    const first = col.cells[0]!.date
    const prev = i === 0 ? null : columns.value[i - 1]!.cells[0]!.date
    if (prev && prev.getMonth() === first.getMonth()) return ''
    const month = first.toLocaleDateString('ru', { month: 'short' })
    const year = first.getFullYear()
    const withYear = lastYear === null || year !== lastYear
    lastYear = year
    return withYear ? `${month} ${year}` : month
  })
})

const rangeFmt = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' })
const rangeLabel = computed(() =>
  `${rangeFmt.format(range.value.start)} – ${rangeFmt.format(range.value.end)}`,
)

const hovered = ref<{ key: string, date: Date } | null>(null)
const pinned = ref<{ key: string, date: Date } | null>(null)

const shown = computed(() => pinned.value ?? hovered.value)

const detail = computed(() => {
  if (!shown.value) return null
  const entry = byDay.value.get(shown.value.key)
  const types = entry
    ? [...entry.types.entries()].sort((a, b) => b[1] - a[1])
    : []
  return { date: shown.value.date, count: entry?.count ?? 0, types }
})

function toggle(key: string, date: Date) {
  pinned.value = pinned.value?.key === key ? null : { key, date }
}

// The panel is always mounted and sized by the layout, never by its content,
// so hovering swaps text without shifting anything.

watch(period, () => {
  pinned.value = null
  hovered.value = null
})

// The day feed is only fetched once a cell is pinned: an empty workspace id
// keeps the underlying query disabled while nothing is selected.
const feedWsId = computed(() => (pinned.value ? props.wsId : ''))
const feedFilters = computed(() => {
  if (!pinned.value) return {}
  const from = new Date(pinned.value.date)
  const to = new Date(from.getTime() + DAY_MS - 1)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    board: props.boardId,
    actor: actor.value === ALL_ACTORS ? undefined : actor.value,
  }
})

const { list: feed } = useActivityApi(feedWsId, feedFilters)
const feedEvents = computed(() => feed.data.value?.events ?? [])

const longFmt = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', weekday: 'long' })
const timeFmt = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' })
const EVENTS = ['событие', 'события', 'событий'] as [string, string, string]
</script>

<template>
  <section class="surface-soft flex h-full min-w-0 flex-col rounded-2xl p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold text-default">Активность по дням</h2>
        <p class="text-xs text-muted">
          {{ rangeLabel }} · {{ total }} {{ plural(total, EVENTS) }}
        </p>
      </div>
      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <div class="flex rounded-lg bg-elevated p-0.5">
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="period === p.value
              ? 'bg-default text-default shadow-sm'
              : 'text-muted hover:text-default'"
            @click="period = p.value"
          >
            {{ p.label }}
          </button>
        </div>
        <USelect v-model="actor" :items="actorItems" class="w-full sm:w-52" />
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="overflow-x-auto pb-1" @mouseleave="hovered = null">
          <div class="flex min-w-max" :style="{ gap: `${gap}px` }">
        <div
          class="flex shrink-0 flex-col pr-1.5 text-[10px] text-muted"
          :style="{ gap: `${gap}px`, paddingTop: `${cell + gap + 1}px` }"
        >
          <span
            v-for="(d, i) in ['Пн', '', 'Ср', '', 'Пт', '', '']"
            :key="i"
            :style="{ height: `${cell}px`, lineHeight: `${cell}px` }"
          >
            {{ d }}
          </span>
        </div>

        <div v-for="(col, i) in columns" :key="col.key" class="flex flex-col" :style="{ gap: `${gap}px` }">
          <span
            class="whitespace-nowrap text-[10px] text-muted"
            :style="{ height: `${cell + 1}px`, lineHeight: `${cell + 1}px` }"
          >
            {{ monthMarks[i] }}
          </span>
          <button
            v-for="c in col.cells"
            :key="c.key"
            type="button"
            :disabled="c.future"
            class="rounded-[3px] transition-transform duration-150"
            :style="{ width: `${cell}px`, height: `${cell}px` }"
            :class="[
              c.future ? 'bg-transparent' : `hm hm--${level(c.count)} cursor-pointer`,
              pinned?.key === c.key
                ? 'scale-125 ring-2 ring-accent-500'
                : hovered?.key === c.key ? 'scale-125 ring-1 ring-default' : '',
            ]"
            @mouseenter="c.future ? null : (hovered = { key: c.key, date: c.date })"
            @click="c.future ? null : toggle(c.key, c.date)"
          />
            </div>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div class="flex items-center gap-1.5 text-[11px] text-muted">
            <span>меньше</span>
            <span v-for="l in [0, 1, 2, 3, 4]" :key="l" class="size-[13px] rounded-[3px]" :class="`hm hm--${l}`" />
            <span>больше</span>
          </div>
          <dl class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
            <div class="flex items-baseline gap-1.5">
              <dt class="text-muted">Активных дней</dt>
              <dd class="font-medium tabular-nums text-default">{{ activeDays }}</dd>
            </div>
            <div class="flex items-baseline gap-1.5">
              <dt class="text-muted">в среднем за неделю</dt>
              <dd class="font-medium tabular-nums text-default">{{ perWeek }}</dd>
            </div>
            <div v-if="bestDay" class="flex items-baseline gap-1.5">
              <dt class="text-muted">пик</dt>
              <dd class="font-medium tabular-nums text-default">
                {{ shortFmt.format(new Date(`${bestDay.day}T00:00:00`)) }} · {{ bestDay.count }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        class="flex min-h-[200px] w-full min-w-0 flex-col overflow-hidden rounded-xl bg-elevated/60 p-4 lg:min-h-0 lg:w-[320px] lg:shrink-0"
      >
      <template v-if="detail">
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p class="text-sm font-medium text-default first-letter:uppercase">
              {{ longFmt.format(detail.date) }}
            </p>
            <p class="text-xs text-muted">
              {{ detail.count }} {{ plural(detail.count, EVENTS) }}
              <template v-if="!pinned"> · нажмите, чтобы закрепить</template>
            </p>
          </div>
          <button
            v-if="pinned"
            type="button"
            class="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-default hover:text-default"
            aria-label="Снять закрепление"
            @click="pinned = null"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>

        <div v-if="detail.types.length" class="mt-2.5 flex flex-wrap gap-1.5">
          <span
            v-for="[type, n] in detail.types"
            :key="type"
            class="rounded-full bg-default px-2 py-0.5 text-[11px] text-muted"
          >
            {{ humanizeTaskEventType(type) }}
            <b class="font-medium tabular-nums text-default">{{ n }}</b>
          </span>
        </div>

          <template v-if="pinned && detail.count">
            <p v-if="feed.isLoading.value" class="mt-3 text-xs text-muted">Загружаю события дня…</p>
            <ul
              v-else
              class="mt-3 grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-x-8 gap-y-1.5 overflow-y-auto pr-1"
            >
              <li v-for="e in feedEvents" :key="e.id" class="flex items-baseline gap-2 text-xs">
                <span class="shrink-0 tabular-nums text-muted">{{ timeFmt.format(new Date(e.createdAt)) }}</span>
                <NuxtLink
                  v-if="e.taskId && e.boardId"
                  :to="pageRoutes.task(wsId, e.boardId, e.taskId)"
                  class="min-w-0 flex-1 truncate text-default hover:text-accent-600"
                >
                  {{ e.taskTitle ?? 'Задача удалена' }}
                </NuxtLink>
                <span v-else class="min-w-0 flex-1 truncate text-default">{{ e.taskTitle ?? 'Задача удалена' }}</span>
                <span class="shrink-0 text-muted">{{ humanizeTaskEventType(e.eventType).toLowerCase() }}</span>
              </li>
            </ul>
          </template>
          <p v-else-if="!pinned" class="mt-3 text-xs text-muted">
            Нажмите на день, чтобы увидеть список задач.
          </p>
        </template>

        <p v-else class="text-xs text-muted">
          Наведите на день, чтобы увидеть сводку, нажмите – чтобы закрепить.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hm--0 { background: #e9e6e2; }
.hm--1 { background: #ffd2b0; }
.hm--2 { background: #ff9d5c; }
.hm--3 { background: #f2600f; }
.hm--4 { background: #a83309; }

:global(.dark) .hm--0 { background: #27272a; }
:global(.dark) .hm--1 { background: #5c2410; }
:global(.dark) .hm--2 { background: #9c3410; }
:global(.dark) .hm--3 { background: #e05410; }
:global(.dark) .hm--4 { background: #ff9d5c; }
</style>
