<script setup lang="ts">
import { glueShortWords } from '~/utils/typograph'

defineProps<{ n: number, label: string, title?: string, lead?: string }>()
</script>

<template>
  <div class="shead reveal">
    <div class="shead__rail" aria-hidden="true" />
    <span class="shead__n"><i>такт {{ String(n).padStart(2, '0') }}</i> · {{ label }}</span>
    <div v-if="title || lead || $slots.default" class="shead__row">
      <h2 v-if="title">{{ glueShortWords(title) }}</h2>
      <p v-if="lead" class="shead__lead muted">{{ glueShortWords(lead) }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shead { padding-top: 56px; margin-bottom: 40px; }
.shead__rail {
  height: 9px;
  background:
    linear-gradient(var(--ink), var(--ink)) left top / 1.5px 100% no-repeat,
    repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px 25%) left bottom / 100% 5px no-repeat;
}
.shead__n {
  display: block;
  margin: 6px 0 14px;
  font: 11px var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.shead__n i { font-style: normal; color: var(--orange); }
.shead__row { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-wrap: wrap; }
.shead__row h2 { max-width: 18ch; }
.shead__lead { font-size: 17px; max-width: 46ch; }
</style>
