export interface Board {
  id: string
  workspaceId: string
  name: string
  slug: string
  color: string
  sleDays: number | null
  sleProbability: string 
  lastReplenishmentAt: string | null
  replenishmentPeriodDays: number
  columnTint: boolean
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
  seedDefaults?: boolean
}

export interface UpdateBoardInput {
  name?: string
  slug?: string
  color?: string
  sleDays?: number | null
  sleProbability?: number
  replenishmentPeriodDays?: number
  columnTint?: boolean
}

export interface SleRecomputeResponse {
  sleDays: number | null
  sampleCount: number
}