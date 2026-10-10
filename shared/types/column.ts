export type ColumnRole = 'backlog' | 'in_progress' | 'review' | 'done' | 'archived'

export interface BoardColumn {
  id: string
  workspaceId: string
  boardId: string
  name: string
  position: number
  wipLimit: number | null
  columnRole: ColumnRole
  isQueue: boolean
  color: string | null
  createdAt: string
}

export interface ColumnsListResponse {
  columns: BoardColumn[]
}

export interface ColumnResponse {
  column: BoardColumn
}

export interface CreateColumnInput {
  name: string
  columnRole: ColumnRole
  wipLimit?: number | null
}

export interface UpdateColumnInput {
  name?: string
  columnRole?: ColumnRole
  wipLimit?: number | null
  isQueue?: boolean
  color?: string | null
}

export interface ReorderColumnsInput {
  orderedIds: string[]
}
