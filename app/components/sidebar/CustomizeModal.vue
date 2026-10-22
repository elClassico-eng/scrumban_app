<script setup lang="ts">
import { SIDEBAR_ITEM_IDS, type SidebarItemId } from '#shared/types/sidebar'
import { SIDEBAR_ITEM_META } from '~/utils/sidebar-items'

const open = defineModel<boolean>('open', { default: false })

const { hidden, setHidden } = useSidebarPrefs()

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
