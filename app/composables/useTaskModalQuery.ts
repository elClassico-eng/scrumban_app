export function useTaskModalQuery() {
  const route = useRoute()
  const router = useRouter()

  const taskId = computed(() => (typeof route.query.task === 'string' ? route.query.task : null))
  const boardId = computed(() => (typeof route.query.board === 'string' ? route.query.board : null))

  function openTask(board: string, task: string) {
    router.push({ query: { ...route.query, board, task } })
  }

  function close() {
    const { task: _task, board: _board, ...rest } = route.query
    router.push({ query: rest })
  }

  const open = computed({
    get: () => !!taskId.value && !!boardId.value,
    set: (v) => {
      if (!v) close()
    },
  })

  return { taskId, boardId, open, openTask }
}
