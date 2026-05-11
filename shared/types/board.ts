export interface Board {
  id: string
  workspaceId: string
  name: string
  slug: string
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
}

export interface UpdateBoardInput {
  name?: string
}