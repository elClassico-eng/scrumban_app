<script setup lang="ts">
import type { TileId } from '#shared/types/control-center'
import type { BoardPulse } from '#shared/types/pulse'
import { TILE_COMPONENTS } from '~/utils/control-center-tile-components'

defineProps<{
  tiles: TileId[]
  pulse: BoardPulse | null
  loading: boolean
  status: 'ok' | 'loading' | 'noBoard' | 'error'
}>()

const BOARD_FREE = new Set<TileId>(['timer', 'presence'])
</script>

<template>
  <div class="grid grid-cols-3 gap-[10px] content-start overflow-y-auto min-h-0 flex-1 pr-0.5" @click.stop>
    <template v-for="id in tiles" :key="id">
      <component
        :is="TILE_COMPONENTS[id]"
        v-if="status === 'ok' || status === 'loading' || BOARD_FREE.has(id)"
        :pulse="pulse"
        :loading="loading"
      />
    </template>
    <div
      v-if="status === 'noBoard' || status === 'error'"
      class="col-span-3 rounded-2xl p-[13px] flex items-center gap-3 text-[12.5px]"
      style="background: var(--island-tile); border: 1px dashed var(--island-line); color: var(--island-ink-2);"
    >
      <UIcon :name="status === 'noBoard' ? 'i-lucide-kanban-square' : 'i-lucide-wifi-off'" class="w-4 h-4 shrink-0" style="color: var(--island-ink-3);" />
      <span>{{ status === 'noBoard' ? 'Нет досок: создай доску, и плитки оживут' : 'Не удалось загрузить пульс доски' }}</span>
    </div>
  </div>
</template>
