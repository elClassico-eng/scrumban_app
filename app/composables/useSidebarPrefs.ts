import { useQueryClient } from '@tanstack/vue-query'
import type { Board } from '#shared/types/board'
import type { SidebarItemId, SidebarPrefs } from '#shared/types/sidebar'

export function useSidebarPrefs() {
  const { me, update } = useProfileApi()
  const qc = useQueryClient()
  const toast = useToast()

  const prefs = computed<SidebarPrefs>(() => me.data.value?.user.sidebarPrefs ?? {})
  const hidden = computed(() => new Set(prefs.value.hidden ?? []))
  const favorites = computed(() => new Set(prefs.value.favorites ?? []))

  function save(patch: Partial<SidebarPrefs>) {
    const prev = me.data.value
    const next = { ...prefs.value, ...patch }
    if (prev) qc.setQueryData(['users', 'me'], { user: { ...prev.user, sidebarPrefs: next } })
    update.mutate({ sidebarPrefs: next }, {
      onError: () => {
        if (prev) qc.setQueryData(['users', 'me'], prev)
        toast.add({ title: 'Не удалось сохранить настройки меню', color: 'error', icon: 'i-hugeicons-alert-circle' })
      },
    })
  }

  function isVisible(id: SidebarItemId) {
    return !hidden.value.has(id)
  }

  function setHidden(ids: SidebarItemId[]) {
    save({ hidden: ids })
  }

  function toggleFavorite(boardId: string) {
    const list = prefs.value.favorites ?? []
    save({ favorites: list.includes(boardId) ? list.filter(id => id !== boardId) : [...list, boardId] })
  }

  function sortBoards(boards: Board[]) {
    const rank = new Map((prefs.value.boardOrder ?? []).map((id, i) => [id, i]))
    const pos = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER
    return [...boards].sort((a, b) => pos(a.id) - pos(b.id))
  }

  function setBoardOrder(workspaceBoardIds: string[]) {
    const own = new Set(workspaceBoardIds)
    const others = (prefs.value.boardOrder ?? []).filter(id => !own.has(id))
    save({ boardOrder: [...workspaceBoardIds, ...others] })
  }

  return { isVisible, hidden, favorites, setHidden, toggleFavorite, sortBoards, setBoardOrder }
}
