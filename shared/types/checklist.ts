export interface TaskChecklistItem {
  id: string
  workspaceId: string
  taskId: string
  title: string
  isDone: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface TaskChecklistListResponse {
  items: TaskChecklistItem[]
}

export interface TaskChecklistItemResponse {
  item: TaskChecklistItem
}

export interface CreateChecklistItemInput {
  title: string
}

export interface UpdateChecklistItemInput {
  title?: string
  isDone?: boolean
}

export interface ReorderChecklistInput {
  orderedIds: string[]
}