<script setup lang="ts">
import { pageRoutes } from '~/routing'

defineProps<{ collapsed: boolean, mobile?: boolean }>()
const emit = defineEmits<{ toggle: [], close: [] }>()
</script>

<template>
  <div
    :class="[
      'flex shrink-0 transition-all duration-300',
      collapsed ? 'flex-col items-center gap-2 px-0 pt-4 pb-2' : 'h-14 items-center gap-2.5 px-4',
    ]"
  >
    <NuxtLink :to="pageRoutes.home" class="takt-logo flex min-w-0 items-center gap-2.5 text-highlighted">
      <TaktMark class="size-6 shrink-0" />
      <span v-if="!collapsed" class="truncate text-base font-semibold tracking-tight">
        Такт
      </span>
    </NuxtLink>
    <button
      type="button"
      :class="[
        'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-default bg-default text-muted transition-colors hover:border-[var(--ui-border-accented)] hover:text-highlighted',
        collapsed ? '' : 'ml-auto',
      ]"
      :title="mobile ? 'Закрыть' : (collapsed ? 'Развернуть' : 'Свернуть')"
      :aria-label="mobile ? 'Закрыть меню' : (collapsed ? 'Развернуть меню' : 'Свернуть меню')"
      @click="mobile ? emit('close') : emit('toggle')"
    >
      <UIcon :name="mobile ? 'i-lucide-x' : (collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left')" class="size-4" />
    </button>
  </div>
</template>
