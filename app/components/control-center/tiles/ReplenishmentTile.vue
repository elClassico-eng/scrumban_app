<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { islandReplenishmentKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const ctx = inject(islandReplenishmentKey)!
const r = computed(() => props.pulse?.board.replenishment ?? null)
const daysLeft = computed(() => {
  if (!r.value?.lastAt) return null
  const due = new Date(r.value.lastAt).getTime() + r.value.periodDays * 86_400_000
  return Math.round((due - Date.now()) / 86_400_000)
})
const label = computed(() => daysLeft.value === null ? null : daysLeft.value < 0 ? `просрочено ${-daysLeft.value} дн` : `через ${daysLeft.value} дн`)
</script>

<template>
  <ControlCenterTilesTileShell label="Пополнение" :clickable="ctx.canMark.value && !!pulse" @click="ctx.onMark($event)">
    <template v-if="label">
      <b class="text-[15px] font-semibold leading-tight" :style="daysLeft !== null && daysLeft < 0 ? 'color: var(--island-orange-2);' : 'color: var(--island-ink);'">{{ label }}</b>
      <span class="text-[11px] text-[var(--island-ink-2)]">{{ ctx.canMark.value ? 'нажми, чтобы отметить' : `период ${r!.periodDays} дн` }}</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-2)]">{{ loading ? '…' : 'Ещё не отмечали' }}</span>
  </ControlCenterTilesTileShell>
</template>
