export interface TaskCommentAuthor {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

export interface TaskComment {
  id: string
  workspaceId: string
  taskId: string
  author: TaskCommentAuthor | null
  body: string
  mentionedUserIds: string[]
  editedAt: string | null
  createdAt: string
  automationRuleId: string | null
  parentId: string | null
  assigneeId: string | null
  resolvedAt: string | null
  resolvedBy: string | null
}

export type AssignedComment = TaskComment & { taskTitle: string, boardId: string }

export interface TaskCommentListResponse {
  comments: TaskComment[]
}

export interface TaskCommentResponse {
  comment: TaskComment
}

export interface CreateTaskCommentInput {
  body: string
  parentId?: string
}

export interface UpdateTaskCommentInput {
  body: string
}