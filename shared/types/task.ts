import type { ServiceClass, TaskEventType } from './domain'

export interface Task {
  assigneeIds: string[]
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
  parentTaskId: string | null
  blockedReason: string | null
  isEpic: boolean
  storyPoints: number | null
  checklistTotal: number
  checklistDone: number
  timeSpentSeconds: number
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
  parentTaskId?: string | null
  storyPoints?: number | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  serviceClass?: ServiceClass
  dueDate?: string | null
  assigneeId?: string | null
  parentTaskId?: string | null
  blockedReason?: string | null
  isEpic?: boolean
  storyPoints?: number | null
}

export interface TaskDependencyView {
  blockerTaskId: string
  blockedTaskId: string
  blockerTitle: string
  blockedTitle: string
  createdAt: string
}

export interface TaskDependenciesResponse {
  blockers: TaskDependencyView[]
  blocks: TaskDependencyView[]
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
