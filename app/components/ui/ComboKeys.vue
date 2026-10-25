<script setup lang="ts">
import { describeCombo } from '~/utils/shortcuts'

const props = defineProps<{ combo: string, size?: 'sm' | 'md' }>()
const view = computed(() => describeCombo(props.combo))
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <template v-for="(k, i) in view.keys" :key="`${k}-${i}`">
      <span v-if="i > 0 && view.chained" class="text-[11px] text-dimmed">затем</span>
      <UKbd :value="k" :size="size ?? 'md'" />
    </template>
  </span>
</template>
