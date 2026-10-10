<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const a = computed(() => props.pulse?.aging ?? null)
</script>

<template>
  <ControlCenterTilesTileShell label="Старение" :clickable="!!pulse" @click="navigate({ path: pageRoutes.board(wsId, pulse!.board.id), query: { daily: '1' } })">
    <template v-if="a && a.p85Days !== null">
      <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none" :style="a.count > 0 ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'">{{ a.count }}</b>
      <span class="text-[11px] text-[var(--island-ink-2)]">старше P85 · {{ a.p85Days }} дн</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-2)]">{{ loading ? '…' : 'P85 не рассчитан' }}</span>
  </ControlCenterTilesTileShell>
</template>
