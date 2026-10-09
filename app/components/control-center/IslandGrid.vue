<script setup lang="ts">
import type { TileId } from '#shared/types/control-center'
import type { BoardPulse } from '#shared/types/pulse'
import { TILE_COMPONENTS } from '~/utils/control-center-tile-components'

defineProps<{
  tiles: TileId[]
  pulse: BoardPulse | null
  loading: boolean
}>()
</script>

<template>
  <div class="grid grid-cols-3 gap-[10px] content-start overflow-y-auto min-h-0 flex-1 pr-0.5">
    <component
      :is="TILE_COMPONENTS[id]"
      v-for="id in tiles"
      :key="id"
      :pulse="pulse"
      :loading="loading"
    />
  </div>
</template>
