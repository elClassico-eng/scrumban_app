<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const open = computed(() => props.pulse?.myTasks.open ?? 0)
</script>

<template>
  <ControlCenterTilesTileShell label="Мои задачи" :clickable="!!pulse" @click="navigate(pageRoutes.board(wsId, pulse!.board.id))">
    <template v-if="pulse && open > 0">
      <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none text-[var(--island-ink)]">{{ open }}</b>
      <span class="text-[11px] text-[var(--island-ink-2)]">{{ pulse.myTasks.inProgress }} в работе</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-2)]">{{ loading ? '…' : 'Нет задач на вас' }}</span>
  </ControlCenterTilesTileShell>
</template>
