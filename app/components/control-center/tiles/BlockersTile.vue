<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const b = computed(() => props.pulse?.blockers ?? null)
</script>

<template>
  <ControlCenterTilesTileShell label="Блокеры" :clickable="!!pulse" @click="navigate({ path: pageRoutes.board(wsId, pulse!.board.id), query: { daily: '1' } })">
    <template v-if="b && b.count > 0">
      <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none" style="color: var(--island-orange-2);">{{ b.count }}</b>
      <span class="text-[11px] text-[var(--island-ink-2)]">самый долгий {{ b.longestDays }} дн</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-3)]">{{ loading ? '…' : 'Блокеров нет' }}</span>
  </ControlCenterTilesTileShell>
</template>
