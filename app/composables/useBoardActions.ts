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

  function recolor(board: Board, color: string) {
    if (color === board.color) return
    update.mutate({ boardId: board.id, color }, { onError: err => fail(err, 'Не удалось сменить цвет') })
  }

  async function copyLink(board: Board) {
    await navigator.clipboard.writeText(`${location.origin}${pageRoutes.board(wsId.value, board.id)}`)
    toast.add({ title: 'Ссылка на доску скопирована', icon: 'i-hugeicons-link-01' })
  }

  function restore(board: Board) {
    update.mutate({ boardId: board.id, archived: false }, {
      onSuccess: () => toast.add({ title: `Доска «${board.name}» восстановлена`, icon: 'i-hugeicons-undo-02' }),
      onError: err => fail(err, 'Не удалось восстановить доску'),
    })
  }

  function archive(board: Board) {
    update.mutate({ boardId: board.id, archived: true }, {
      onSuccess: () => {
        leaveIfOpen(board)
        toast.add({
          title: `Доска «${board.name}» в архиве`,
          description: 'Её можно вернуть со страницы «Доски».',
          icon: 'i-hugeicons-archive',
          actions: [{ label: 'Вернуть', color: 'neutral', variant: 'outline', onClick: () => restore(board) }],
        })
      },
      onError: err => fail(err, 'Не удалось убрать доску в архив'),
    })
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

  return { rename, recolor, copyLink, archive, restore, askDelete, confirmDelete, deleteTarget, deleting: remove.isPending }
}
