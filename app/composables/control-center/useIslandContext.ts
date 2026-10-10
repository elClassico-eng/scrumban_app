import type { Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import type { ControlCenterPrefs, ControlCenterTab, TileId } from '#shared/types/control-center'
import { resolveContextBoard } from '~/utils/control-center-context'
import { normalizeTiles } from '~/utils/control-center-tiles'

export function useIslandContext(workspaceId: Ref<string>) {
  const route = useRoute()
  const { list: boardsList } = useBoardsApi(workspaceId)
  const { me, update } = useProfileApi()

  const boards = computed(() => (boardsList.data.value?.boards ?? []).map(b => ({ id: b.id, name: b.name })))
  const prefs = computed<ControlCenterPrefs>(() => me.data.value?.user.controlCenterPrefs ?? {})
  const override = ref<string | null>(null)

  const routeBoardId = computed(() => (typeof route.params.boardId === 'string' ? route.params.boardId : null))
  watch(routeBoardId, () => { override.value = null })

  const boardId = computed<string | null>(() =>
    resolveContextBoard({
      routeBoardId: routeBoardId.value,
      overrideBoardId: override.value,
      lastBoardId: prefs.value.lastBoardId,
      boards: boards.value,
    }),
  )

  const boardName = computed(() => boards.value.find(b => b.id === boardId.value)?.name ?? null)

  const qc = useQueryClient()
  const toast = useToast()

  function savePrefs(patch: Partial<ControlCenterPrefs>) {
    const merged = { ...prefs.value, ...patch }
    const next: ControlCenterPrefs = {
      ...merged,
      ...(merged.overview ? { overview: normalizeTiles(merged.overview, 'overview') } : {}),
      ...(merged.flow ? { flow: normalizeTiles(merged.flow, 'flow') } : {}),
    }
    const prev = me.data.value
    if (prev) qc.setQueryData(['users', 'me'], { user: { ...prev.user, controlCenterPrefs: next } })
    update.mutate({ controlCenterPrefs: next }, {
      onError: () => {
        if (prev) qc.setQueryData(['users', 'me'], prev)
        toast.add({ title: 'Не удалось сохранить раскладку', color: 'error', icon: 'i-lucide-alert-circle' })
      },
    })
  }

  function setBoard(id: string) {
    override.value = id
    savePrefs({ lastBoardId: id })
  }

  function setTiles(tab: ControlCenterTab, tiles: TileId[]) {
    savePrefs({ [tab]: tiles })
  }

  return { boardId, boardName, boards, prefs, setBoard, setTiles }
}
