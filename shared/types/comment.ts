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
}

export interface TaskCommentListResponse {
  comments: TaskComment[]
}

export interface TaskCommentResponse {
  comment: TaskComment
}

export interface CreateTaskCommentInput {
  body: string
}

export interface UpdateTaskCommentInput {
  body: string
}