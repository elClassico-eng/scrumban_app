import type { TaskEventType } from './domain'

export interface ActivityEvent {
  id: string
  eventType: TaskEventType
  taskId: string
  taskTitle: string | null
  boardId: string | null
  boardName: string | null
  fromColumnId: string | null
  toColumnId: string | null
  actorId: string | null
  actorFirstName: string | null
  actorLastName: string | null
  actorEmail: string | null
  payload: unknown
  createdAt: string
}

export interface ActivityListResponse {
  events: ActivityEvent[]
}

export interface ActivityFiltersQuery {
  board?: string
  actor?: string
  event?: string
  from?: string
  to?: string
}