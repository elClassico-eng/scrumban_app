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
  capacity: number | null
  createdAt: string
  updatedAt: string
}

export interface SprintsListResponse {
  sprints: Sprint[]
}

export type WorkspaceSprintSummary = Sprint & { boardName: string }

export type WorkspaceSprintsResponse = { sprints: WorkspaceSprintSummary[] }

export interface SprintResponse {
  sprint: Sprint
}

export interface CreateSprintInput {
  name: string
  goal?: string
  plannedStartAt?: string | null
  plannedEndAt?: string | null
  capacity?: number | null
  taskIds?: string[]
}

export interface UpdateSprintInput {
  name?: string
  goal?: string
  plannedStartAt?: string | null
  plannedEndAt?: string | null
  capacity?: number | null
  datesChangeReason?: string
}

export type CarryOverDecision = 'next_sprint' | 'backlog' | 'keep'

export type CloseSprintInput = {
  goalAchieved?: boolean | null
  goalComment?: string
  carryOver?: { taskId: string; decision: CarryOverDecision }[]
}

export interface AddTaskToSprintInput {
  taskId: string
}

export interface BurndownPoint {
  day: number
  date: string
  ideal: number
  actual: number | null
}

export interface BurndownReport {
  totalDays: number
  totalSp: number
  doneSp: number
  points: BurndownPoint[]
}
export type SprintPreviewRisk =
  | { type: 'unestimated'; taskIds: string[] }
  | { type: 'external_dependency'; taskId: string; blockerTaskId: string; blockerTitle: string }

export type SprintPreviewReport =
  | {
      ok: true
      horizonDays: number | null
      taskCount: number
      edgeCount: number
      totalStoryPoints: number
      tasks: import('./network').NetworkTaskView[]
      criticalPathIds: string[]
      pert: {
        expectedDurationDays: number
        sigmaDays: number
        probabilityWithinHorizon: number | null
      }
      simulation: {
        iterations: number
        p50Days: number
        p85Days: number
        p95Days: number
        probabilityWithinHorizon: number | null
      }
      risks: SprintPreviewRisk[]
    }
  | {
      ok: false
      reason: 'insufficient_data'
      closedSamples: number
      requiredSamples: number
      risks: SprintPreviewRisk[]
    }
