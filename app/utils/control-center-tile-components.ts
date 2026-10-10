import type { Component } from 'vue'
import type { TileId } from '#shared/types/control-center'
import TimerTile from '~/components/control-center/tiles/TimerTile.vue'
import MyTasksTile from '~/components/control-center/tiles/MyTasksTile.vue'
import FiringsTile from '~/components/control-center/tiles/FiringsTile.vue'
import SprintTile from '~/components/control-center/tiles/SprintTile.vue'
import DueSoonTile from '~/components/control-center/tiles/DueSoonTile.vue'
import PresenceTile from '~/components/control-center/tiles/PresenceTile.vue'
import WipTile from '~/components/control-center/tiles/WipTile.vue'
import AgingTile from '~/components/control-center/tiles/AgingTile.vue'
import BlockersTile from '~/components/control-center/tiles/BlockersTile.vue'
import SleTile from '~/components/control-center/tiles/SleTile.vue'
import ThroughputTile from '~/components/control-center/tiles/ThroughputTile.vue'
import ReplenishmentTile from '~/components/control-center/tiles/ReplenishmentTile.vue'

export const TILE_COMPONENTS: Record<TileId, Component> = {
  timer: TimerTile,
  my_tasks: MyTasksTile,
  firings: FiringsTile,
  sprint: SprintTile,
  due_soon: DueSoonTile,
  presence: PresenceTile,
  wip: WipTile,
  aging: AgingTile,
  blockers: BlockersTile,
  sle: SleTile,
  throughput: ThroughputTile,
  replenishment: ReplenishmentTile,
}
