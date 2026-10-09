import type { Ref } from 'vue'
import type { ControlCenterPrefs } from '#shared/types/control-center'
import { resolveContextBoard } from '~/utils/control-center-context'

export function useIslandContext(workspaceId: Ref<string>) {
  const route = useRoute()
  const { list: boardsList } = useBoardsApi(workspaceId)
  const { me, update } = useProfileApi()

  const boards = computed(() => (boardsList.data.value?.boards ?? []).map(b => ({ id: b.id, name: b.name })))
  const prefs = computed<ControlCenterPrefs>(() => me.data.value?.user.controlCenterPrefs ?? {})
  const override = ref<string | null>(null)

  const boardId = computed<string | null>(() => {
    const routeBoardId = typeof route.params.boardId === 'string' ? route.params.boardId : null
    return resolveContextBoard({
      routeBoardId,
      lastBoardId: override.value ?? prefs.value.lastBoardId,
      boards: boards.value,
    })
  })

  const boardName = computed(() => boards.value.find(b => b.id === boardId.value)?.name ?? null)

  function setBoard(id: string) {
    override.value = id
    update.mutate({ controlCenterPrefs: { ...prefs.value, lastBoardId: id } })
  }

  return { boardId, boardName, boards, prefs, setBoard }
}
