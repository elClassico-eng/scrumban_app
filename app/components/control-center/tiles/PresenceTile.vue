<script setup lang="ts">
import type { BoardPulse } from '#shared/types/pulse'
import { islandPresenceKey } from '~/composables/control-center/useIslandInjection'

defineProps<{ pulse: BoardPulse | null; loading: boolean }>()
const p = inject(islandPresenceKey)!
</script>

<template>
  <ControlCenterPresenceTile :people="p.people.value" :extra="p.extra.value" @view-all="p.onViewAll" />
</template>
