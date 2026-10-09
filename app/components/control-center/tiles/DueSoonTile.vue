<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { pageRoutes } from '~/routing'
import { islandNavigateKey, islandWorkspaceKey } from '~/composables/control-center/useIslandInjection'

const props = defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const navigate = inject(islandNavigateKey)!
const wsId = inject(islandWorkspaceKey)!
const d = computed(() => props.pulse?.dueSoon ?? null)
const when = computed(() => {
  if (!d.value) return ''
  const days = Math.ceil((new Date(d.value.dueDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `просрочено ${-days} дн`
  if (days === 0) return 'сегодня'
  return `через ${days} дн`
})
const overdue = computed(() => !!d.value && new Date(d.value.dueDate).getTime() < Date.now())
</script>

<template>
  <ControlCenterTilesTileShell label="Ближайший дедлайн" :clickable="!!d" @click="navigate(pageRoutes.task(wsId, pulse!.board.id, d!.taskId))">
    <template v-if="d">
      <span class="text-[13.5px] font-medium leading-[1.3] text-[var(--island-ink)] line-clamp-2">{{ d.title }}</span>
      <span class="text-[11px] font-semibold" :style="overdue ? 'color: var(--island-orange-2);' : 'color: var(--island-ink-2);'">{{ when }}</span>
    </template>
    <span v-else class="text-[13px] text-[var(--island-ink-3)]">{{ loading ? '…' : 'Дедлайнов нет' }}</span>
  </ControlCenterTilesTileShell>
</template>
