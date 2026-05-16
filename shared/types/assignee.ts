export interface TaskAssigneeView {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  addedAt: string
}

export interface TaskAssigneesListResponse {
  assignees: TaskAssigneeView[]
}

export interface AddTaskAssigneeInput {
  userId: string
}
