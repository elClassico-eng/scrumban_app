export interface Board {
  id: string
  workspaceId: string
  name: string
  slug: string
  color: string
  icon: string | null
  key: string
  taskSeq: number
  sleDays: number | null
  sleProbability: string 
  lastReplenishmentAt: string | null
  replenishmentPeriodDays: number
  columnTint: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BoardsListResponse {
  boards: Board[]
}

export interface BoardResponse {
  board: Board
}

export interface CreateBoardInput {
  name: string
  slug: string
  color?: string
  icon?: string | null
  key?: string
  seedDefaults?: boolean
}

export interface UpdateBoardInput {
  name?: string
  slug?: string
  color?: string
  icon?: string | null
  key?: string
  sleDays?: number | null
  sleProbability?: number
  replenishmentPeriodDays?: number
  columnTint?: boolean
  archived?: boolean
}

export interface SleRecomputeResponse {
  sleDays: number | null
  sampleCount: number
}