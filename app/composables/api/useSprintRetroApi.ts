import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useEventSource } from '@vueuse/core'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

export type RetroCategory = 'went_well' | 'to_improve' | 'action_item'
export type RetroPhase = 'collect' | 'discuss'

export type RetroNote = {
  id: string
  sprintId: string
  category: RetroCategory
  body: string
  authorId: string | null
  taskId: string | null
  convertedTaskId: string | null
  isResolved: boolean
  assigneeId: string | null
  dueDate: string | null
  voteCount: number
  votedByMe: boolean
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export type RetroBoardView = { phase: RetroPhase, notes: RetroNote[], myVotesLeft: number }

type NotePatch = {
  noteId: string
  body?: string
  category?: RetroCategory
  isResolved?: boolean
  assigneeId?: string | null
  dueDate?: string | null
}

export function useSprintRetroApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
  opts: { live?: boolean } = {},
) {
  const qc = useQueryClient()
  const key = computed(() => ['sprint-retro', unref(workspaceId), unref(boardId), unref(sprintId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: key.value })
  const base = computed(() => apiRoutes.sprintRetro(unref(workspaceId), unref(boardId), unref(sprintId)))
  const noteUrl = (noteId: string) => apiRoutes.sprintRetroNote(unref(workspaceId), unref(boardId), unref(sprintId), noteId)

  const board = useQuery({
    queryKey: key,
    queryFn: () => $fetch<RetroBoardView>(base.value),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
  })
  const notes = computed(() => board.data.value?.notes ?? [])

  if (opts.live) {
    const { data } = useEventSource(
      computed(() => apiRoutes.boardStream(unref(workspaceId), unref(boardId))),
      ['retro.changed'],
      { autoReconnect: { retries: 3, delay: 2_000 } },
    )
    watch(data, (raw) => {
      if (!raw) return
      try {
        if ((JSON.parse(raw) as { payload?: { sprintId?: string } }).payload?.sprintId === unref(sprintId)) invalidate()
      }
      catch { /* ignore malformed event */ }
    })
  }

  const create = useMutation({
    mutationFn: (input: { category: RetroCategory, body: string, taskId?: string | null }) =>
      $fetch<{ note: RetroNote }>(base.value, { method: 'POST', body: input }),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ noteId, ...patch }: NotePatch) =>
      $fetch<{ note: RetroNote }>(noteUrl(noteId), { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (noteId: string) => $fetch<{ ok: boolean }>(noteUrl(noteId), { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const convert = useMutation({
    mutationFn: (noteId: string) =>
      $fetch<{ note: RetroNote, taskId: string, addedToSprintId: string | null }>(
        apiRoutes.sprintRetroConvert(unref(workspaceId), unref(boardId), unref(sprintId), noteId),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })

  const setPhase = useMutation({
    mutationFn: (phase: RetroPhase) => $fetch(base.value, { method: 'PATCH', body: { phase } }),
    onSuccess: invalidate,
  })

  const vote = useMutation({
    mutationFn: ({ noteId, on }: { noteId: string, on: boolean }) =>
      $fetch(`${noteUrl(noteId)}/vote`, { method: on ? 'PUT' : 'DELETE' }),
    onMutate: async ({ noteId, on }) => {
      await qc.cancelQueries({ queryKey: key.value })
      const prev = qc.getQueryData<RetroBoardView>(key.value)
      if (prev) {
        qc.setQueryData<RetroBoardView>(key.value, {
          ...prev,
          myVotesLeft: prev.myVotesLeft + (on ? -1 : 1),
          notes: prev.notes.map(n => (n.id === noteId ? { ...n, votedByMe: on, voteCount: n.voteCount + (on ? 1 : -1) } : n)),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key.value, ctx.prev)
    },
    onSettled: invalidate,
  })

  return { board, notes, create, update, remove, convert, setPhase, vote }
}
