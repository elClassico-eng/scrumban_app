<script setup lang="ts">
import { PALETTE_UI, useCommandGroups } from '~/composables/control-center/useCommandGroups'

const props = defineProps<{
  workspaceId: string
  boardId: string | null
  active: boolean
  focusTick: number
}>()

const emit = defineEmits<{
  done: []
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId ?? '')
const term = ref('')
const root = ref<HTMLElement | null>(null)

const { groups } = useCommandGroups(wsId, bId, () => emit('done'))

function focusInput() {
  term.value = ''
  nextTick(() => root.value?.querySelector('input')?.focus())
}

watch(() => props.active, (on) => { if (on) focusInput() }, { immediate: true })
watch(() => props.focusTick, () => { if (props.active) focusInput() })
</script>

<template>
  <div
    ref="root"
    class="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
    @click.stop
  >
    <UCommandPalette
      v-model:search-term="term"
      :groups="groups"
      :fuse="{ resultLimit: 50 }"
      placeholder="Поиск задач, действий, страниц…"
      class="flex-1 min-h-0"
      :ui="PALETTE_UI"
    >
      <template #empty>
        <div class="flex flex-col items-center gap-2">
          <UIcon name="i-lucide-search-x" class="size-8 text-[var(--island-ink-3)] opacity-40" />
          <span>Ничего не найдено</span>
        </div>
      </template>
    </UCommandPalette>
  </div>
</template>
