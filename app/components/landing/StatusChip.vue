<script setup lang="ts">
type ChipKind = 'done' | 'dev' | 'plan'

defineProps<{ kind: ChipKind, onLight?: boolean }>()

const LABELS: Record<ChipKind, string> = {
  done: 'готово',
  dev: 'в разработке',
  plan: 'в планах',
}
</script>

<template>
  <span class="chip" :class="[kind, { 'on-light': onLight }]">
    <span class="ico" />{{ LABELS[kind] }}
  </span>
</template>