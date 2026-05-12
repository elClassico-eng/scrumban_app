import type { ServiceClass, TaskEventType } from './domain'

export interface Task {
  id: string
  workspaceId: string
  boardId: string
  columnId: string
  title: string
  description: string
  assigneeId: string | null
  serviceClass: ServiceClass
  dueDate: string | null
  expeditedAt: string | null
  position: number
  closedAt: string | null
  reopenedCount: number
  createdAt: string
  updatedAt: string
}

export interface TasksListResponse {
  tasks: Task[]
}

export interface TaskResponse {
  task: Task
}

export interface CreateTaskInput {
  columnId: string
  title: string
  description?: string
  serviceClass?: ServiceClass
  dueDate?: string | null
  assigneeId?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  serviceClass?: ServiceClass
  dueDate?: string | null
  assigneeId?: string | null
}

export interface MoveTaskInput {
  toColumnId: string
  toPosition: number
  force?: boolean
}

export interface TaskEvent {
  id: string
  workspaceId: string
  taskId: string
  eventType: TaskEventType
  fromColumnId: string | null
  toColumnId: string | null
  actorId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface TaskEventsListResponse {
  events: TaskEvent[]
}
