<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const cols = computed(() => props.pulse?.wip ?? [])
function width(c: { count: number; limit: number | null }): string {
  const max = Math.max(c.limit ?? 0, c.count, 1)
  return `${Math.round((c.count / max) * 100)}%`
}
</script>

<template>
  <ControlCenterTilesTileShell label="WIP по колонкам" :clickable="!!pulse" @click="navigate(pageRoutes.board(wsId, pulse!.board.id))">
    <div v-if="cols.length > 0" class="flex flex-col gap-[6px]">
      <div v-for="c in cols" :key="c.columnId" class="flex flex-col gap-[3px]">
        <div class="flex items-center justify-between text-[11px]">
          <span class="truncate text-[var(--island-ink-2)]">{{ c.name }}</span>
          <span class="font-mono font-semibold" :style="c.limit !== null && c.count > c.limit ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'">
            {{ c.count }}<span class="text-[var(--island-ink-3)]">{{ c.limit !== null ? `/${c.limit}` : '' }}</span>
          </span>
        </div>
        <div class="h-[4px] rounded-full overflow-hidden" style="background: var(--island-track);">
          <div class="h-full rounded-full" :style="{ width: width(c), background: c.limit !== null && c.count > c.limit ? 'var(--island-orange-2)' : 'var(--island-ink-3)' }" />
        </div>
      </div>
    </div>
    <span v-else class="text-[13px] text-[var(--island-ink-2)]">{{ loading ? '…' : 'Нет рабочих колонок' }}</span>
  </ControlCenterTilesTileShell>
</template>
