<script setup lang="ts">
import { BOARD_COLOR_LABELS, BOARD_COLORS, DEFAULT_BOARD_COLOR } from '#shared/constants/board-colors'

const model = defineModel<string>({ default: DEFAULT_BOARD_COLOR })
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="c in BOARD_COLORS"
      :key="c"
      type="button"
      :aria-label="BOARD_COLOR_LABELS[c]"
      :aria-pressed="model === c"
      :title="BOARD_COLOR_LABELS[c]"
      :style="{ background: c }"
      class="grid size-7 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-[var(--ui-bg)] transition-[box-shadow,transform] duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-text)]"
      :class="model === c ? 'ring-2 ring-[var(--ui-text)]' : ''"
      @click="model = c"
    >
      <UIcon
        v-if="model === c"
        name="i-hugeicons-check"
        class="size-4 text-white drop-shadow"
      />
    </button>
  </div>
</template>
