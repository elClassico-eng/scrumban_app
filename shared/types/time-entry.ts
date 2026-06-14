export interface TimeEntry {
  id: string
  workspaceId: string
  taskId: string
  userId: string
  startedAt: string
  durationSeconds: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface TimeEntryView extends TimeEntry {
  elapsedSeconds: number
  running: boolean
}

export interface TaskTimeResponse {
  entries: TimeEntryView[]
  totalSeconds: number
}

export interface CreateTimeEntryInput {
  startedAt: string
  durationSeconds: number
  description?: string | null
}

export interface UpdateTimeEntryInput {
  startedAt?: string
  durationSeconds?: number
  description?: string | null
}

export interface ActiveTimerView {
  entry: TimeEntryView
  taskTitle: string
  taskShortId: string
  boardId: string
}

export interface ActiveTimerResponse {
  active: ActiveTimerView | null
}

export interface TimeReportResponse {
  byUser: Array<{ userId: string, totalSeconds: number }>
  bySprint: Array<{ sprintId: string, sprintName: string, totalSeconds: number }>
}
