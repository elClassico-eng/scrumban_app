<script setup lang="ts">
import type { ShortcutHint } from '~/composables/useGlobalShortcuts'

defineProps<{ hints: ShortcutHint[] }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" title="Горячие клавиши" description="Работают везде, кроме полей ввода." :ui="{ content: 'max-w-sm' }">
    <template #body>
      <ul class="flex flex-col gap-1">
        <li v-for="h in hints" :key="h.label" class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
          <span class="text-default">{{ h.label }}</span>
          <span class="flex items-center gap-1">
            <template v-for="(k, i) in h.keys" :key="k">
              <span v-if="i > 0 && h.keys[0] === 'G'" class="text-xs text-dimmed">затем</span>
              <UKbd :value="k" />
            </template>
          </span>
        </li>
      </ul>
    </template>
  </UModal>
</template>
