import { pageRoutes } from '~/routing'

export type ShortcutHint = { keys: string[], label: string }

export function useGlobalShortcuts() {
  const router = useRouter()
  const route = useRoute()
  const { current } = useCurrentWorkspace()
  const ccActions = useControlCenterActions()
  const helpOpen = useState('shortcuts-help-open', () => false)

  function goTo(path: (ws: string) => string) {
    return () => {
      if (current.value) router.push(path(current.value.id))
    }
  }

  const SHORTCUTS: (ShortcutHint & { combo: string, run: () => void })[] = [
    { combo: 'g-i', keys: ['G', 'I'], label: 'Входящие', run: goTo(pageRoutes.workspaceInbox) },
    { combo: 'g-m', keys: ['G', 'M'], label: 'Мои задачи', run: goTo(pageRoutes.workspaceMyTasks) },
    { combo: 'g-o', keys: ['G', 'O'], label: 'Обзор воркспейса', run: goTo(pageRoutes.workspace) },
    { combo: 'g-b', keys: ['G', 'B'], label: 'Доски', run: goTo(pageRoutes.boards) },
    {
      combo: 'c',
      keys: ['C'],
      label: 'Новая задача (на странице доски)',
      run: () => {
        if (route.params.boardId) ccActions.requestCreateTask()
      },
    },
    { combo: '?', keys: ['?'], label: 'Эта подсказка', run: () => { helpOpen.value = !helpOpen.value } },
  ]

  defineShortcuts(Object.fromEntries(SHORTCUTS.map(s => [s.combo, s.run])))

  const hints: ShortcutHint[] = [
    { keys: ['⌘', 'K'], label: 'Поиск и команды' },
    ...SHORTCUTS.map(({ keys, label }) => ({ keys, label })),
  ]

  return { helpOpen, hints }
}
