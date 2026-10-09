<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const sle = computed(() => props.pulse?.board.sleDays ?? null)
</script>

<template>
  <ControlCenterTilesTileShell label="SLE">
    <template v-if="sle !== null">
      <b class="text-[26px] font-semibold tracking-[-0.02em] leading-none" style="color: var(--island-orange-2);">≤ {{ sle }} дн</b>
      <span class="text-[11px] text-[var(--island-ink-2)] flex items-center gap-1">
        ожидание по доске
        <AnalyticsInfo
          answers="Service Level Expectation: «N% задач закрывается за ≤ M дней» – перцентиль времени выполнения по закрытым задачам доски."
          action="От этого порога краснеют зависшие карточки на доске. Пересчитать из истории – в настройках доски."
        />
      </span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-3)]">{{ loading ? '…' : 'SLE не рассчитан' }}</span>
  </ControlCenterTilesTileShell>
</template>
