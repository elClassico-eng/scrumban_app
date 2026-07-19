export type SprintActivityKind =
  | 'sprint_started'
  | 'sprint_closed'
  | 'dates_changed'
  | 'capacity_changed'
  | 'task_added'
  | 'task_removed'
  | 'task_blocked'
  | 'task_unblocked'

export type SprintActivityItem = {
  id: string
  kind: SprintActivityKind
  atISO: string
  sprintId: string | null
  sprintName: string | null
  taskId: string | null
  taskTitle: string | null
  reason: string | null
}

export type SprintActivityResponse = {
  items: SprintActivityItem[]
}
