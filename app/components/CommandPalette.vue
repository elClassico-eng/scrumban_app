<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const { searchTick, requestCreateTask } = useControlCenterActions()
const { focus, toggle: toggleFocus } = useFocusMode()
const colorMode = useColorMode()
const { logout } = useAuthApi()

const open = ref(false)
const term = ref('')

const wsId = computed(() => (route.params.id as string) ?? '')
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

function go(to: ReturnType<typeof pageRoutes.boards>) {
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
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'dark max-w-xl p-0 overflow-hidden bg-[#16161a] border border-white/[0.09]', overlay: 'bg-black/60' }"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :fuse="{ resultLimit: 50 }"
        placeholder="Поиск задач, действий, страниц…"
        class="h-[440px]"
      />
    </template>
  </UModal>
</template>
