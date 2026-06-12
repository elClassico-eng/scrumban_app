<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const { searchTick, requestCreateTask } = useControlCenterActions()
const { focus, toggle: toggleFocus } = useFocusMode()
const colorMode = useColorMode()
const { logout } = useAuthApi()

const wsStore = useWorkspaceStore()

const open = ref(false)
const term = ref('')

const wsId = computed(() => (route.params.id as string) || wsStore.currentId || '')
const bId = computed(() => (route.params.boardId as string) ?? '')
const onBoard = computed(() => !!wsId.value && !!bId.value)

const { list: tasksList } = useTasksApi(wsId, bId)
const { list: columnsList } = useColumnsApi(wsId, bId)

const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const columns = computed(() =>
  [...(columnsList.data.value?.columns ?? [])].sort((a, b) => a.position - b.position),
)

const { list: workspacesList } = useWorkspacesApi()
const role = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value)?.role,
)
const canCreateTask = computed(() => hasRole(role.value, 'member'))

watch(searchTick, () => {
  term.value = ''
  open.value = true
})

defineShortcuts({
  meta_k: () => {
    term.value = ''
    open.value = true
  },
})

function selectTask(id: string) {
  open.value = false
  router.push(pageRoutes.task(wsId.value, bId.value, id))
}

function go(to: string) {
  open.value = false
  router.push(to)
}

function createTask() {
  open.value = false
  if (bId.value) {
    requestCreateTask()
  } else if (wsId.value) {
    router.push(pageRoutes.boards(wsId.value))
  }
}

function toggleTheme() {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
  open.value = false
}

const groups = computed<CommandPaletteGroup[]>(() => {
  const result: CommandPaletteGroup[] = []

  if (onBoard.value) {
    for (const col of columns.value) {
      const colTasks = tasks.value.filter(t => t.columnId === col.id)
      if (colTasks.length === 0) continue
      result.push({
        id: col.id,
        label: col.name,
        items: colTasks.map<CommandPaletteItem>(t => ({
          label: t.title,
          suffix: t.id.slice(0, 6).toUpperCase(),
          icon: 'i-lucide-square-check-big',
          onSelect: () => selectTask(t.id),
        })),
      })
    }
  }

  const actionItems: CommandPaletteItem[] = []

  if (canCreateTask.value) {
    actionItems.push({
      label: 'Создать задачу',
      icon: 'i-lucide-plus',
      onSelect: createTask,
    })
  }

  actionItems.push(
    {
      label: focus.value ? 'Выключить фокус' : 'Включить фокус',
      icon: 'i-lucide-focus',
      onSelect: () => {
        toggleFocus()
        open.value = false
      },
    },
    {
      label: 'Переключить тему',
      icon: 'i-lucide-sun-moon',
      onSelect: toggleTheme,
    },
    {
      label: 'Выйти',
      icon: 'i-lucide-log-out',
      onSelect: () => {
        logout.mutate()
        open.value = false
      },
    },
  )

  result.push({ id: 'actions', label: 'Действия', items: actionItems })

  if (wsId.value) {
    const navItems: CommandPaletteItem[] = [
      {
        label: 'Доски',
        icon: 'i-lucide-columns-3',
        onSelect: () => go(pageRoutes.boards(wsId.value)),
      },
      {
        label: 'Участники',
        icon: 'i-lucide-users',
        onSelect: () => go(pageRoutes.workspaceMembers(wsId.value)),
      },
      {
        label: 'Активность',
        icon: 'i-lucide-activity',
        onSelect: () => go(pageRoutes.workspaceActivity(wsId.value)),
      },
    ]

    if (onBoard.value) {
      navItems.push(
        {
          label: 'Аналитика',
          icon: 'i-lucide-bar-chart-2',
          onSelect: () => go(pageRoutes.boardAnalytics(wsId.value, bId.value)),
        },
        {
          label: 'Спринты',
          icon: 'i-lucide-zap',
          onSelect: () => go(pageRoutes.boardSprints(wsId.value, bId.value)),
        },
        {
          label: 'Календарь',
          icon: 'i-lucide-calendar',
          onSelect: () => go(pageRoutes.boardCalendar(wsId.value, bId.value)),
        },
        {
          label: 'Таймлайн',
          icon: 'i-lucide-gantt-chart',
          onSelect: () => go(pageRoutes.boardTimeline(wsId.value, bId.value)),
        },
      )
    }

    result.push({ id: 'nav', label: 'Навигация', items: navItems })
  }

  return result
})

const paletteUi = {
  root: 'flex flex-col min-h-0 min-w-0 divide-y divide-[var(--island-line)]',
  input: '[&>input]:h-14 [&>input]:text-[var(--island-ink)] [&>input]:placeholder-[var(--island-ink-3)] [&>input]:bg-transparent [&>input]:text-sm [&>input]:ps-11 [&>input]:pe-4',
  content: 'relative overflow-hidden flex flex-col',
  viewport: 'divide-y divide-[var(--island-line-2)] overflow-y-auto flex-1 focus:outline-none',
  group: 'p-1.5 isolate',
  label: 'px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-[var(--island-ink-3)]',
  item: 'group relative w-full flex items-center select-none outline-none rounded-lg px-2 py-2.5 text-sm gap-2.5 transition-colors data-highlighted:bg-[var(--island-hover)] data-highlighted:not-data-disabled:text-[var(--island-ink)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
  itemLeadingIcon: 'shrink-0 size-4 text-[var(--island-ink-3)] group-data-highlighted:text-[var(--island-ink-2)] transition-colors',
  itemWrapper: 'flex-1 flex flex-col text-start min-w-0',
  itemLabel: 'truncate space-x-1',
  itemLabelBase: 'text-[var(--island-ink-2)] group-data-highlighted:text-[var(--island-ink)] transition-colors [&>mark]:text-[var(--island-bg)] [&>mark]:bg-[var(--island-orange)]',
  itemLabelSuffix: 'font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--island-fill)] text-[var(--island-ink-3)] [&>mark]:text-[var(--island-bg)] [&>mark]:bg-[var(--island-orange)]',
  itemTrailing: 'ms-auto inline-flex items-center gap-1.5',
  itemTrailingIcon: 'shrink-0 size-4 text-[var(--island-ink-3)]',
  itemTrailingHighlightedIcon: 'shrink-0 size-4 text-[var(--island-orange)] hidden group-data-highlighted:inline-flex',
  itemTrailingKbds: 'hidden lg:inline-flex items-center shrink-0 gap-0.5',
  empty: 'py-10 text-center text-sm text-[var(--island-ink-3)]',
  footer: 'px-3 py-2 border-t border-[var(--island-line)] flex items-center justify-between',
} as const
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'max-w-xl p-0 overflow-hidden bg-[var(--island-bg)] border border-[var(--island-line)] shadow-2xl', overlay: 'bg-black/70 backdrop-blur-sm' }"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :fuse="{ resultLimit: 50 }"
        placeholder="Поиск задач, действий, страниц…"
        class="h-[460px]"
        :ui="paletteUi"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-2">
            <UIcon name="i-lucide-search-x" class="size-8 text-[var(--island-ink-3)] opacity-40" />
            <span>Ничего не найдено</span>
          </div>
        </template>

        <template #footer>
          <div class="flex items-center gap-3 text-[11px] text-[var(--island-ink-3)]">
            <span class="flex items-center gap-1">
              <span class="inline-flex items-center px-1 py-0.5 rounded bg-[var(--island-fill)] border border-[var(--island-line)] font-mono leading-none">↑↓</span>
              навигация
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-flex items-center px-1 py-0.5 rounded bg-[var(--island-fill)] border border-[var(--island-line)] font-mono leading-none">↵</span>
              открыть
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-flex items-center px-1 py-0.5 rounded bg-[var(--island-fill)] border border-[var(--island-line)] font-mono leading-none">esc</span>
              закрыть
            </span>
          </div>
          <span class="flex items-center gap-1 text-[11px] text-[var(--island-ink-3)]">
            <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--island-orange-soft)] border border-[var(--island-orange-tint-border)] font-mono leading-none text-[var(--island-orange-2)]">⌘K</span>
          </span>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
