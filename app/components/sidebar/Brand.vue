<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { sidebarFade } from '~/utils/sidebar-items'
import { describeCombo } from '~/utils/shortcuts'

defineProps<{ collapsed: boolean, peek?: boolean, mobile?: boolean }>()
const emit = defineEmits<{ toggle: [], close: [] }>()

const { combos } = useShortcutPrefs()
const hotkey = computed(() => describeCombo(combos.value.toggle_sidebar).keys.join(' + '))
</script>

<template>
  <div class="flex h-14 shrink-0 items-center gap-2.5 overflow-hidden pl-2.5 pr-3">
    <button
      v-if="collapsed && !mobile"
      type="button"
      class="group grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-highlighted transition-colors hover:bg-elevated"
      :title="`Развернуть (${hotkey})`"
      aria-label="Развернуть меню"
      @click="emit('toggle')"
    >
      <TaktMark class="size-6 group-hover:hidden" />
      <UIcon name="i-hugeicons-sidebar-left" class="hidden size-[18px] text-muted group-hover:block" />
    </button>
    <NuxtLink v-else :to="pageRoutes.home" external class="takt-logo grid size-9 shrink-0 place-items-center text-highlighted">
      <TaktMark class="size-6" />
    </NuxtLink>
    <span :class="['truncate text-base font-semibold tracking-tight text-highlighted', sidebarFade(collapsed)]">Такт</span>
    <button
      type="button"
      :class="['ml-auto grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-highlighted', sidebarFade(collapsed)]"
      :title="mobile ? 'Закрыть' : (peek ? `Закрепить открытым (${hotkey})` : `Свернуть (${hotkey})`)"
      :aria-label="mobile ? 'Закрыть меню' : (peek ? 'Закрепить меню открытым' : 'Свернуть меню')"
      :tabindex="collapsed ? -1 : 0"
      @click="mobile ? emit('close') : emit('toggle')"
    >
      <UIcon :name="mobile ? 'i-hugeicons-x' : (peek ? 'i-hugeicons-pin' : 'i-hugeicons-sidebar-left')" class="size-[18px]" />
    </button>
  </div>
</template>
