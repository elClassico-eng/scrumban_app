<script setup lang="ts">
import { SIDEBAR_ITEM_IDS, type SidebarFrame, type SidebarItemId } from '#shared/types/sidebar'
import { SIDEBAR_ITEM_META } from '~/utils/sidebar-items'

const open = defineModel<boolean>('open', { default: false })

const { hidden, setHidden, frame, setFrame } = useSidebarPrefs()
const colorMode = useColorMode()
const darkTheme = computed(() => colorMode.value === 'dark')

const FRAMES: { value: SidebarFrame, label: string, canvas: string }[] = [
  { value: 'dark', label: 'Тёмная', canvas: 'bg-neutral-950' },
  { value: 'light', label: 'Светлая', canvas: 'bg-white ring-1 ring-inset ring-neutral-200' },
]

function toggle(id: SidebarItemId, visible: boolean) {
  const next = new Set(hidden.value)
  if (visible) next.delete(id)
  else next.add(id)
  setHidden(SIDEBAR_ITEM_IDS.filter(i => next.has(i)))
}
</script>

<template>
  <UModal v-model:open="open" title="Настроить сайдбар" description="Скрытые пункты остаются доступны по прямой ссылке." :ui="{ content: 'max-w-sm' }">
    <template #body>
      <p class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Рамка</p>
      <div :class="['grid grid-cols-2 gap-2 px-2', darkTheme ? 'mb-2' : 'mb-5']" role="radiogroup" aria-label="Цвет рамки" :aria-disabled="darkTheme">
        <button
          v-for="f in FRAMES"
          :key="f.value"
          type="button"
          role="radio"
          :aria-checked="frame === f.value"
          :disabled="darkTheme"
          :class="[
            'rounded-xl border p-2 text-left transition-colors',
            darkTheme ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            frame === f.value && !darkTheme ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-default',
            darkTheme ? '' : 'hover:border-[var(--ui-border-accented)]',
          ]"
          @click="setFrame(f.value)"
        >
          <span :class="['flex h-14 gap-1 rounded-lg p-1', f.canvas]">
            <span class="flex w-3 flex-col items-center gap-1 pt-0.5">
              <span v-for="i in 4" :key="i" :class="['size-1.5 rounded-full', f.value === 'dark' ? 'bg-neutral-500' : 'bg-neutral-400']" />
            </span>
            <span class="flex-1 rounded-md border border-neutral-200 bg-white" />
          </span>
          <span class="mt-1.5 block text-sm font-medium">{{ f.label }}</span>
        </button>
      </div>
      <p v-if="darkTheme" class="mb-5 px-2 text-xs text-dimmed">
        В тёмной теме рамка всегда тёмная, чтобы ничего не слепило. Выбор работает в светлой теме.
      </p>
      <p class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-dimmed">Пункты</p>
      <ul class="flex flex-col gap-1">
        <li v-for="id in SIDEBAR_ITEM_IDS" :key="id">
          <label class="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-elevated">
            <UIcon :name="SIDEBAR_ITEM_META[id].icon" class="size-4 shrink-0 text-muted" />
            <span class="flex-1 text-sm">{{ SIDEBAR_ITEM_META[id].label }}</span>
            <USwitch :model-value="!hidden.has(id)" @update:model-value="(v: boolean) => toggle(id, v)" />
          </label>
        </li>
      </ul>
      <p class="mt-3 px-2 text-xs text-dimmed">
        Порядок досок меняется перетаскиванием прямо в сайдбаре, избранное – звёздочкой у доски.
      </p>
    </template>
  </UModal>
</template>
