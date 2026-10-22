<script setup lang="ts">
import type { LeaderHint } from '~/composables/useGlobalShortcuts'

defineProps<{ hint: LeaderHint | null }>()
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none"
    leave-active-class="transition-[opacity,translate] duration-100 ease-in motion-reduce:transition-none"
    enter-from-class="opacity-0 translate-y-2"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="hint"
      class="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-inverted px-4 py-2.5 text-sm text-inverted shadow-xl"
      role="status"
    >
      <UKbd :value="hint.leader" />
      <span class="opacity-60">затем</span>
      <span v-for="o in hint.options" :key="o.key" class="flex items-center gap-1.5">
        <UKbd :value="o.key" />
        <span>{{ o.label }}</span>
      </span>
    </div>
  </Transition>
</template>
