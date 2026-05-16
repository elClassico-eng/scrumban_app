import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  CreateTaskCommentInput,
  TaskCommentListResponse,
  TaskCommentResponse,
  UpdateTaskCommentInput,
} from '#shared/types/comment'

export function useTaskCommentsApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'task-comments',
    unref(workspaceId),
    unref(boardId),
    unref(taskId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<TaskCommentListResponse>(
        apiRoutes.taskComments(unref(workspaceId), unref(boardId), unref(taskId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateTaskCommentInput) =>
      $fetch<TaskCommentResponse>(
        apiRoutes.taskComments(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST', body: input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const update = useMutation({
    mutationFn: ({ commentId, body }: { commentId: string } & UpdateTaskCommentInput) =>
      $fetch<TaskCommentResponse>(
        apiRoutes.taskComment(unref(workspaceId), unref(boardId), unref(taskId), commentId),
        { method: 'PATCH', body: { body } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (commentId: string) =>
      $fetch(
        apiRoutes.taskComment(unref(workspaceId), unref(boardId), unref(taskId), commentId),
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { list, create, update, remove }
}