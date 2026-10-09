<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const s = computed(() => props.pulse?.sprint ?? null)
</script>

<template>
  <ControlCenterTilesTileShell label="Спринт" :clickable="!!pulse" @click="navigate(pageRoutes.boardSprints(wsId, pulse!.board.id))">
    <template v-if="s">
      <div class="flex items-baseline gap-2">
        <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none text-[var(--island-ink)]">{{ s.pct }}%</b>
        <span class="text-[11px] text-[var(--island-ink-3)]">{{ s.daysLeft }} дн</span>
      </div>
      <div class="h-[4px] rounded-full overflow-hidden" style="background: var(--island-track);">
        <div class="h-full rounded-full" :style="{ width: `${s.pct}%`, background: 'var(--island-orange-2)' }" />
      </div>
      <span class="text-[11px] text-[var(--island-ink-2)] truncate">
        {{ s.probability === null ? s.name : `шанс в срок ${s.probability}%` }}
      </span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-3)]">{{ loading ? '…' : 'Нет активного спринта' }}</span>
  </ControlCenterTilesTileShell>
</template>
