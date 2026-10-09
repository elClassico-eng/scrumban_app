export const TILE_IDS = [
  'timer',
  'my_tasks',
  'firings',
  'sprint',
  'due_soon',
  'presence',
  'wip',
  'aging',
  'blockers',
  'sle',
  'throughput',
  'replenishment',
] as const

export type TileId = (typeof TILE_IDS)[number]

export type ControlCenterTab = 'overview' | 'flow'

export type ControlCenterPrefs = {
  overview?: TileId[]
  flow?: TileId[]
  lastBoardId?: string | null
}
