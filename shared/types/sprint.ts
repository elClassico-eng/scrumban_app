import type { SprintState } from './domain'

export interface Sprint {
  id: string
  workspaceId: string
  boardId: string
  name: string
  goal: string
  state: SprintState
  plannedStartAt: string | null
  plannedEndAt: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SprintsListResponse {
  sprints: Sprint[]
}

export interface SprintResponse {
  sprint: Sprint
}

export interface CreateSprintInput {
  name: string
  goal?: string
  plannedStartAt?: string | null
  plannedEndAt?: string | null
}

export interface UpdateSprintInput {
  name?: string
  goal?: string
  plannedStartAt?: string | null
  plannedEndAt?: string | null
}

export interface AddTaskToSprintInput {
  taskId: string
}