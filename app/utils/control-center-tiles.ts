import { TILE_IDS, type ControlCenterTab, type TileId } from '#shared/types/control-center'

export type TileMeta = { tab: ControlCenterTab; label: string; icon: string }

export const TILE_CATALOG: Record<TileId, TileMeta> = {
  timer: { tab: 'overview', label: 'Активная задача', icon: 'i-hugeicons-timer-02' },
  my_tasks: { tab: 'overview', label: 'Мои задачи', icon: 'i-hugeicons-user-check-01' },
  firings: { tab: 'overview', label: 'Горит', icon: 'i-hugeicons-zap' },
  sprint: { tab: 'overview', label: 'Спринт', icon: 'i-hugeicons-flag-02' },
  due_soon: { tab: 'overview', label: 'Ближайший дедлайн', icon: 'i-hugeicons-calendar-clock' },
  presence: { tab: 'overview', label: 'Команда', icon: 'i-hugeicons-users' },
  wip: { tab: 'flow', label: 'WIP по колонкам', icon: 'i-hugeicons-layers-01' },
  aging: { tab: 'flow', label: 'Старение', icon: 'i-hugeicons-hourglass' },
  blockers: { tab: 'flow', label: 'Блокеры', icon: 'i-hugeicons-octagon' },
  sle: { tab: 'flow', label: 'SLE', icon: 'i-hugeicons-sparkles' },
  throughput: { tab: 'flow', label: 'Throughput', icon: 'i-hugeicons-trending-up' },
  replenishment: { tab: 'flow', label: 'Пополнение', icon: 'i-hugeicons-refresh-cw' },
}

export const DEFAULT_TILES: Record<ControlCenterTab, TileId[]> = {
  overview: ['timer', 'my_tasks', 'firings', 'sprint', 'due_soon', 'presence'],
  flow: ['wip', 'aging', 'blockers', 'sle', 'throughput', 'replenishment'],
}

const KNOWN = new Set<string>(TILE_IDS)

export function normalizeTiles(ids: unknown, tab: ControlCenterTab): TileId[] {
  if (!Array.isArray(ids)) return DEFAULT_TILES[tab]
  const out: TileId[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !KNOWN.has(id) || out.includes(id as TileId)) continue
    if (TILE_CATALOG[id as TileId].tab !== tab) continue
    out.push(id as TileId)
  }
  return out.length > 0 ? out : DEFAULT_TILES[tab]
}

export function availableTiles(tab: ControlCenterTab, current: TileId[]): TileId[] {
  return TILE_IDS.filter((id) => TILE_CATALOG[id].tab === tab && !current.includes(id))
}
