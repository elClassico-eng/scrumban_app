<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const days = computed(() => props.pulse?.throughput7 ?? [])
const total = computed(() => days.value.reduce((a, b) => a + b, 0))
const max = computed(() => Math.max(1, ...days.value))
</script>

<template>
  <ControlCenterTilesTileShell label="Throughput" :clickable="!!pulse" @click="navigate(pageRoutes.boardAnalytics(wsId, pulse!.board.id))">
    <template v-if="pulse && total > 0">
      <div class="flex items-baseline gap-1.5">
        <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none text-[var(--island-ink)]">{{ total }}</b>
        <span class="text-[11px] text-[var(--island-ink-3)]">за 7 дн</span>
      </div>
      <div class="flex items-end gap-[3px] h-[22px]">
        <div
          v-for="(n, i) in days"
          :key="i"
          class="flex-1 rounded-[2px]"
          :style="{ height: `${Math.max(8, (n / max) * 100)}%`, background: i === days.length - 1 ? 'var(--island-orange-2)' : 'var(--island-ink-3)' }"
        />
      </div>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-3)]">{{ loading ? '…' : 'Нет закрытий за неделю' }}</span>
  </ControlCenterTilesTileShell>
</template>
