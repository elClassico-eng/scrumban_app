<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { islandTimerKey } from '~/composables/control-center/useIslandInjection'

defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const t = inject(islandTimerKey)!
</script>

<template>
  <ControlCenterTaskTimerTile
    :task-id="t.taskId.value"
    :task-title="t.taskTitle.value"
    :seconds="t.seconds.value"
    :running="t.running.value"
    :active="t.active.value"
    @toggle="t.onToggle"
    @stop="t.onStop"
  />
</template>
