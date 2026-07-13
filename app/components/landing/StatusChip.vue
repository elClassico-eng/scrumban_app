<script setup lang="ts">
type ChipKind = 'done' | 'dev' | 'plan'

defineProps<{ kind: ChipKind }>()

const LABELS: Record<ChipKind, string> = {
  done: 'работает',
  dev: 'в разработке',
  plan: 'в планах',
}
</script>

<template>
  <span class="schip" :class="`schip--${kind}`">
    <span class="schip__dot" />{{ LABELS[kind] }}
  </span>
</template>
