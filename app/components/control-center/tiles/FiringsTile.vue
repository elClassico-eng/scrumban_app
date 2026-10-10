<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import type { AutomationTrigger } from '#shared/types/automation'
import { pageRoutes } from '~/routing'
import { TRIGGER_INFO } from '~/utils/automation-labels'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const count = computed(() => props.pulse?.firings.count ?? 0)
const latest = computed(() => {
  const t = props.pulse?.firings.latestTrigger as AutomationTrigger | null | undefined
  return t ? TRIGGER_INFO[t].label : null
})
</script>

<template>
  <ControlCenterTilesTileShell label="Горит" :clickable="!!pulse" :accent="count > 0" @click="navigate(pageRoutes.boardAutomations(wsId, pulse!.board.id))">
    <template v-if="pulse && count > 0">
      <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none" style="color: var(--island-orange-2);">{{ count }}</b>
      <span class="text-[11px] text-[var(--island-ink-2)] truncate">{{ latest }}</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-2)]">{{ loading ? '…' : 'Тихо' }}</span>
  </ControlCenterTilesTileShell>
</template>
