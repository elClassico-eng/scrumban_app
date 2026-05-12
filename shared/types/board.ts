export interface Board {
  id: string
  workspaceId: string
  name: string
  slug: string
  sleDays: number | null
  sleProbability: string 
  lastReplenishmentAt: string | null
  replenishmentPeriodDays: number
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
  seedDefaults?: boolean
}

export interface UpdateBoardInput {
  name?: string
  sleDays?: number | null
  sleProbability?: number
  replenishmentPeriodDays?: number
}

export interface SleRecomputeResponse {
  sleDays: number | null
  sampleCount: number
}