import type { MaybeRefOrGetter } from 'vue'
import type { Board } from '#shared/types/board'
import { pageRoutes } from '~/routing'

export function useBoardActions(workspaceId: MaybeRefOrGetter<string>) {
  const wsId = computed(() => toValue(workspaceId))
  const { update, remove } = useBoardsApi(wsId)
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const deleteTarget = useState<Board | null>('board-delete-target', () => null)
  const editTarget = useState<Board | null>('board-edit-target', () => null)

  function fail(err: unknown, fallback: string) {
    toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }

  function leaveIfOpen(board: Board) {
    if (route.params.boardId === board.id) router.push(pageRoutes.boards(wsId.value))
  }

  function rename(board: Board, name: string) {
    const next = name.trim()
    if (!next || next === board.name) return
    update.mutate({ boardId: board.id, name: next }, { onError: err => fail(err, 'Не удалось переименовать доску') })
  }

  async function copyLink(board: Board) {
    await navigator.clipboard.writeText(`${location.origin}${pageRoutes.board(wsId.value, board.id)}`)
    toast.add({ title: 'Ссылка на доску скопирована', icon: 'i-hugeicons-link-01' })
  }

  async function restore(board: Board) {
    try {
      await update.mutateAsync({ boardId: board.id, archived: false })
      toast.add({ title: `Доска «${board.name}» восстановлена`, icon: 'i-hugeicons-undo-02' })
    }
    catch (err) {
      fail(err, 'Не удалось восстановить доску')
    }
  }

  async function archive(board: Board) {
    try {
      await update.mutateAsync({ boardId: board.id, archived: true })
    }
    catch (err) {
      fail(err, 'Не удалось убрать доску в архив')
      return
    }
    leaveIfOpen(board)
    toast.add({
      title: `Доска «${board.name}» в архиве`,
      icon: 'i-hugeicons-archive',
      actions: [
        { label: 'Вернуть', color: 'neutral', variant: 'outline', onClick: () => { restore(board) } },
        { label: 'Открыть архив', color: 'neutral', variant: 'ghost', onClick: () => { router.push(archiveRoute()) } },
      ],
    })
  }

  function archiveRoute() {
    return { path: pageRoutes.boards(wsId.value), query: { archive: '1' } }
  }

  function askEdit(board: Board) {
    editTarget.value = board
  }

  function askDelete(board: Board) {
    deleteTarget.value = board
  }

  async function confirmDelete() {
    const board = deleteTarget.value
    if (!board) return
    try {
      await remove.mutateAsync(board.id)
      leaveIfOpen(board)
      deleteTarget.value = null
      toast.add({ title: `Доска «${board.name}» удалена`, icon: 'i-hugeicons-delete-02' })
    }
    catch (err) {
      fail(err, 'Не удалось удалить доску')
    }
  }

  return { rename, copyLink, archive, restore, archiveRoute, askEdit, editTarget, askDelete, confirmDelete, deleteTarget, deleting: remove.isPending }
}
