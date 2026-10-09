<script setup lang="ts">
import draggable from 'vuedraggable'
import type { ControlCenterTab, TileId } from '#shared/types/control-center'
import { availableTiles, DEFAULT_TILES, TILE_CATALOG } from '~/utils/control-center-tiles'

const props = defineProps<{
  tab: ControlCenterTab
  tiles: TileId[]
  reducedMotion: boolean
}>()

const emit = defineEmits<{
  'update:tiles': [tiles: TileId[]]
  done: []
}>()

const local = ref<{ id: TileId }[]>(props.tiles.map(id => ({ id })))
watch(() => props.tiles, (t) => { local.value = t.map(id => ({ id })) })

function commit(next: TileId[]) {
  emit('update:tiles', next)
}

function onOrder() {
  commit(local.value.map(t => t.id))
}

function remove(id: TileId) {
  commit(local.value.filter(t => t.id !== id).map(t => t.id))
}

function add(id: TileId) {
  commit([...local.value.map(t => t.id), id])
}

const spare = computed(() => availableTiles(props.tab, local.value.map(t => t.id)))
const isDefault = computed(() => JSON.stringify(local.value.map(t => t.id)) === JSON.stringify(DEFAULT_TILES[props.tab]))
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-[10px]" @click.stop>
    <draggable
      v-model="local"
      item-key="id"
      handle=".drag"
      class="grid grid-cols-3 gap-[10px] content-start overflow-y-auto min-h-0 flex-1 pr-0.5"
      ghost-class="opacity-40"
      :animation="reducedMotion ? 0 : 150"
      @end="onOrder"
    >
      <template #item="{ element }">
        <div
          class="rounded-2xl p-[11px] flex items-center gap-2 min-h-[64px]"
          style="background: var(--island-tile); border: 1px dashed var(--island-line);"
        >
          <span class="drag cursor-grab active:cursor-grabbing text-[var(--island-ink-3)] shrink-0">
            <UIcon name="i-lucide-grip-vertical" class="w-4 h-4" />
          </span>
          <UIcon :name="TILE_CATALOG[element.id as TileId].icon" class="w-[14px] h-[14px] shrink-0" style="color: var(--island-orange-2);" />
          <span class="flex-1 min-w-0 truncate text-[12px] font-semibold text-[var(--island-ink)]">{{ TILE_CATALOG[element.id as TileId].label }}</span>
          <button
            type="button"
            class="w-6 h-6 rounded-md grid place-items-center border-none cursor-pointer shrink-0"
            style="background: var(--island-fill); color: var(--island-ink-3);"
            :title="`Убрать «${TILE_CATALOG[element.id as TileId].label}»`"
            @click="remove(element.id as TileId)"
          >
            <UIcon name="i-lucide-x" class="w-3 h-3" />
          </button>
        </div>
      </template>
    </draggable>

    <div class="flex flex-wrap items-center gap-[6px] shrink-0">
      <button
        v-for="id in spare"
        :key="id"
        type="button"
        class="h-[26px] px-2.5 rounded-full inline-flex items-center gap-1 text-[11.5px] font-semibold border-none cursor-pointer transition-colors"
        style="background: var(--island-fill); color: var(--island-ink-2);"
        @click="add(id)"
      >
        <UIcon name="i-lucide-plus" class="w-3 h-3" />
        {{ TILE_CATALOG[id].label }}
      </button>
      <span v-if="spare.length === 0" class="text-[11.5px] text-[var(--island-ink-3)]">Все плитки включены</span>
      <div class="flex-1" />
      <button
        v-if="!isDefault"
        type="button"
        class="h-[26px] px-2.5 rounded-full text-[11.5px] font-semibold border-none cursor-pointer"
        style="background: transparent; color: var(--island-ink-3);"
        @click="commit(DEFAULT_TILES[tab])"
      >
        Сбросить
      </button>
      <button
        type="button"
        class="h-[26px] px-3 rounded-full text-[11.5px] font-semibold border-none cursor-pointer"
        style="background: var(--island-orange); color: #fff;"
        @click="emit('done')"
      >
        Готово
      </button>
    </div>
  </div>
</template>
