<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  sprint: Sprint
  backlog: Task[]
  columns: BoardColumn[]
  members: MemberView[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: [taskIds: string[]]
}>()

const selected = ref<Set<string>>(new Set())
const query = ref('')
const filter = ref<'all' | 'urgent' | 'stale'>('all')

watch(open, (v) => {
  if (!v) {
    selected.value = new Set()
    query.value = ''
    filter.value = 'all'
  }
})

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function ageInDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

const STALE_THRESHOLD_DAYS = 14

const filteredBacklog = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.backlog.filter((t) => {
    if (filter.value === 'urgent' && t.serviceClass !== 'expedite') return false
    if (filter.value === 'stale' && ageInDays(t.createdAt) < STALE_THRESHOLD_DAYS) return false
    if (q) {
      const id = t.id.slice(0, 8).toLowerCase()
      if (!id.includes(q) && !t.title.toLowerCase().includes(q)) return false
    }
    return true
  })
})

const counts = computed(() => ({
  all: props.backlog.length,
  urgent: props.backlog.filter(t => t.serviceClass === 'expedite').length,
  stale: props.backlog.filter(t => ageInDays(t.createdAt) >= STALE_THRESHOLD_DAYS).length,
}))

const selectedSum = computed(() =>
  props.backlog
    .filter(t => selected.value.has(t.id))
    .reduce((acc, t) => acc + (t.storyPoints ?? 0), 0),
)

const columnById = computed(() => {
  const m = new Map<string, BoardColumn>()
  for (const c of props.columns) m.set(c.id, c)
  return m
})

const memberById = computed(() => {
  const m = new Map<string, MemberView>()
  for (const member of props.members) m.set(member.userId, member)
  return m
})

const CLASS_BADGE: Partial<Record<Task['serviceClass'], { label: string; className: string }>> = {
  expedite: { label: 'Срочная', className: 'bg-accent-500 text-white' },
  intangible: { label: 'Фон', className: 'bg-elevated text-muted' },
  fixed_date: { label: 'С дедлайном', className: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
}

const FILTERS: { key: typeof filter.value; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'urgent', label: 'Срочные' },
  { key: 'stale', label: 'Долго в бэклоге' },
]

function onConfirm() {
  if (selected.value.size === 0) return
  emit('confirm', [...selected.value])
}

function onClose() {
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 bg-black/55 backdrop-blur-sm z-40"
        @click="onClose"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-x-full"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="open"
        class="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-default shadow-2xl z-50 flex flex-col"
      >
        <header class="flex items-start gap-3 px-5 py-4 border-b border-default">
          <div class="flex-1 min-w-0">
            <h3 class="text-[16px] font-semibold tracking-tight text-default">
              Добавить задачу в спринт
            </h3>
            <div class="text-[12.5px] text-muted truncate mt-0.5">
              В <b class="text-default">{{ sprint.name }}</b>
            </div>
          </div>
          <button
            type="button"
            class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
            title="Закрыть"
            @click="onClose"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </header>

        <div class="px-5 py-3 border-b border-default">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Найти задачу по ID или заголовку…"
            size="md"
            class="w-full"
            autofocus
          />
        </div>

        <div class="flex items-center gap-1.5 px-5 py-2.5 border-b border-default">
          <button
            v-for="f in FILTERS"
            :key="f.key"
            type="button"
            class="h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            :class="filter === f.key
              ? 'bg-inverted text-inverted'
              : 'bg-transparent text-muted hover:bg-elevated'"
            @click="filter = f.key"
          >
            {{ f.label }}
            <span
              class="text-[10.5px]"
              :class="filter === f.key ? 'text-white/70' : 'text-dimmed'"
            >
              {{ counts[f.key] }}
            </span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div
            v-if="filteredBacklog.length === 0"
            class="text-center py-16 px-5 text-muted"
          >
            <div class="text-[13.5px] text-default mb-1">Ничего не нашлось</div>
            <div class="text-[12px]">Попробуй другой запрос</div>
          </div>

          <div v-else class="divide-y divide-default">
            <button
              v-for="t in filteredBacklog"
              :key="t.id"
              type="button"
              class="w-full flex gap-3 px-5 py-3 text-left transition-colors cursor-pointer"
              :class="selected.has(t.id)
                ? 'bg-accent-50/40'
                : 'bg-default hover:bg-muted'"
              @click="toggle(t.id)"
            >
              <span
                class="size-4 rounded grid place-items-center shrink-0 mt-0.5 border transition-colors"
                :class="selected.has(t.id)
                  ? 'bg-accent-500 border-accent-500 text-white'
                  : 'border-zinc-400 bg-default'"
              >
                <UIcon v-if="selected.has(t.id)" name="i-lucide-check" class="size-3" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium text-default leading-snug">
                  {{ t.title }}
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-1 text-[11.5px] text-muted">
                  <span class="font-mono">{{ t.id.slice(0, 8).toUpperCase() }}</span>
                  <span
                    v-if="CLASS_BADGE[t.serviceClass]"
                    class="text-[10.5px] font-medium px-1.5 py-0.5 rounded"
                    :class="CLASS_BADGE[t.serviceClass]!.className"
                  >
                    {{ CLASS_BADGE[t.serviceClass]!.label }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1"
                    :class="ageInDays(t.createdAt) >= STALE_THRESHOLD_DAYS ? 'text-accent-600' : ''"
                  >
                    <UIcon name="i-lucide-calendar" class="size-3" />
                    {{ ageInDays(t.createdAt) }} дн в бэклоге
                  </span>
                  <span v-if="columnById.get(t.columnId)" class="text-dimmed">
                    · {{ columnById.get(t.columnId)!.name }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center -space-x-1.5">
                  <UserAvatar
                    v-for="userId in t.assigneeIds.slice(0, 2)"
                    :key="userId"
                    :user="memberById.get(userId) ?? null"
                    size="xs"
                    ring
                  />
                </div>
                <span v-if="t.storyPoints != null" class="text-[11.5px] text-muted">
                  <b class="text-default font-semibold">{{ t.storyPoints }}</b> SP
                </span>
              </div>
            </button>
          </div>
        </div>

        <footer class="flex items-center gap-2 px-5 py-3.5 border-t border-default bg-muted/50">
          <div class="flex-1 text-[12.5px] text-default">
            Выбрано: <b>{{ selected.size }}</b> задач
            <span v-if="selected.size > 0" class="ml-2 inline-flex items-center gap-1 text-accent-700">
              <UIcon name="i-lucide-zap" class="size-3" />
              {{ selectedSum }} SP
            </span>
          </div>
          <UButton size="sm" variant="ghost" color="neutral" @click="onClose">
            Отмена
          </UButton>
          <UButton
            size="sm"
            icon="i-lucide-plus"
            :disabled="selected.size === 0"
            @click="onConfirm"
          >
            Добавить {{ selected.size > 0 ? `(${selected.size})` : '' }}
          </UButton>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>
