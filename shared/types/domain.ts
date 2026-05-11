export type Role = 'viewer' | 'member' | 'scrum_master' | 'admin' | 'owner'

export type SprintState = 'planned' | 'active' | 'closed'

export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskEventType =
  | 'task_created'
  | 'task_moved'
  | 'task_closed'
  | 'task_reopened'
  | 'task_assigned'
  | 'task_updated'
  | 'task_archived'

export interface Task {
  id: string
  workspaceId: string
  boardId: string
  columnId: string
  title: string
  description: string
  assigneeId: string | null
  priority: TaskPriority
  position: number
  closedAt: string | null
  reopenedCount: number
  createdAt: string
  updatedAt: string
}