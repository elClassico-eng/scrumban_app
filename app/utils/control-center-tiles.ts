import { TILE_IDS, type ControlCenterTab, type TileId } from '#shared/types/control-center'

export type TileMeta = { tab: ControlCenterTab; label: string; icon: string }

export const TILE_CATALOG: Record<TileId, TileMeta> = {
  timer: { tab: 'overview', label: 'Активная задача', icon: 'i-lucide-timer' },
  my_tasks: { tab: 'overview', label: 'Мои задачи', icon: 'i-lucide-user-check' },
  firings: { tab: 'overview', label: 'Горит', icon: 'i-lucide-zap' },
  sprint: { tab: 'overview', label: 'Спринт', icon: 'i-lucide-flag' },
  due_soon: { tab: 'overview', label: 'Ближайший дедлайн', icon: 'i-lucide-calendar-clock' },
  presence: { tab: 'overview', label: 'Команда', icon: 'i-lucide-users' },
  wip: { tab: 'flow', label: 'WIP по колонкам', icon: 'i-lucide-layers' },
  aging: { tab: 'flow', label: 'Старение', icon: 'i-lucide-hourglass' },
  blockers: { tab: 'flow', label: 'Блокеры', icon: 'i-lucide-octagon' },
  sle: { tab: 'flow', label: 'SLE', icon: 'i-lucide-sparkles' },
  throughput: { tab: 'flow', label: 'Throughput', icon: 'i-lucide-trending-up' },
  replenishment: { tab: 'flow', label: 'Пополнение', icon: 'i-lucide-refresh-cw' },
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
