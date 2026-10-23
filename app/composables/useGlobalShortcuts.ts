import type { ShortcutId } from '#shared/types/shortcuts'
import { pageRoutes } from '~/routing'
import { resolveContextBoard } from '~/utils/control-center-context'
import { isPunctuationCombo, keyOf, matchesCombo, SHORTCUT_DEFS } from '~/utils/shortcuts'

export type LeaderHint = { leader: string, options: { key: string, label: string }[] }

const LEADER_HINT_MS = 1200

export function useGlobalShortcuts() {
  const router = useRouter()
  const route = useRoute()
  const { current } = useCurrentWorkspace()
  const ccActions = useControlCenterActions()
  const { combos } = useShortcutPrefs()
  const help = useHelpPanel()
  const activeElement = useActiveElement()
  const { me } = useProfileApi()
  const { list: boardsList } = useBoardsApi(computed(() => current.value?.id ?? ''))
  const toast = useToast()
  const uiStore = useUiStore()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  function goTo(path: (ws: string) => string) {
    return () => {
      if (current.value) router.push(path(current.value.id))
    }
  }

  const handlers: Record<ShortcutId, () => void> = {
    go_inbox: goTo(pageRoutes.workspaceInbox),
    go_my_tasks: goTo(pageRoutes.workspaceMyTasks),
    go_overview: goTo(pageRoutes.workspace),
    go_boards: goTo(pageRoutes.boards),
    new_task: () => {
      if (!current.value) return
      const boardId = resolveContextBoard({
        routeBoardId: typeof route.params.boardId === 'string' ? route.params.boardId : null,
        lastBoardId: me.data.value?.user.controlCenterPrefs.lastBoardId,
        boards: boardsList.data.value?.boards ?? [],
      })
      if (!boardId) {
        toast.add({ title: 'Сначала создайте доску', icon: 'i-hugeicons-square-kanban' })
        return
      }
      const boardPath = pageRoutes.board(current.value.id, boardId)
      if (route.path === boardPath) ccActions.requestCreateTask()
      else router.push({ path: boardPath, query: { create: '1' } })
    },
    toggle_sidebar: () => {
      if (isDesktop.value) uiStore.toggleSidebar()
      else uiStore.toggleMobileNav()
    },
  }

  defineShortcuts(
    computed(() => Object.fromEntries((Object.keys(handlers) as ShortcutId[])
      .filter(id => !isPunctuationCombo(combos.value[id]))
      .map(id => [combos.value[id], handlers[id]]))),
    { layoutIndependent: true, chainDelay: LEADER_HINT_MS },
  )

  const hint = ref<LeaderHint | null>(null)
  let hintTimer: ReturnType<typeof setTimeout> | undefined

  function typing(): boolean {
    const el = activeElement.value
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  useEventListener('keydown', (e: KeyboardEvent) => {
    if (typing()) return
    const stroke = { code: e.code, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }
    const punctuation = (Object.keys(handlers) as ShortcutId[])
      .find(id => isPunctuationCombo(combos.value[id]) && matchesCombo(combos.value[id], stroke))
    if (punctuation) {
      e.preventDefault()
      handlers[punctuation]()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === '?') {
      if (help.open.value) help.open.value = false
      else help.show('page')
      return
    }
    if (hint.value) {
      hint.value = null
      return
    }
    const key = keyOf(e.code)
    if (!key) return
    const options = (Object.keys(combos.value) as ShortcutId[])
      .filter(id => combos.value[id].startsWith(`${key}-`))
      .map(id => ({ key: combos.value[id].split('-')[1]!.toUpperCase(), label: SHORTCUT_DEFS[id].label }))
    if (!options.length) return
    hint.value = { leader: key.toUpperCase(), options }
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { hint.value = null }, LEADER_HINT_MS)
  })

  return { hint }
}
