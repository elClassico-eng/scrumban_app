<script setup lang="ts">
type Person = {
  id: string
  name: string
  color: string
  initials: string
  avatarUrl?: string | null
}

const props = defineProps<{
  people: Person[]
  extra: number
}>()

defineEmits<{
  'view-all': [e: Event]
}>()

const tooltipItems = computed(() =>
  props.people.map(p => ({
    id: p.id,
    name: p.name,
    designation: null,
    image: p.avatarUrl ?? null,
    initials: p.initials,
    color: p.color,
  })),
)
</script>

<template>
  <div
    class="inline-flex flex-col self-start rounded-2xl p-[13px]"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Команда</div>
    <span
      v-if="people.length === 0"
      class="text-[11.5px] text-[var(--island-ink-3)]"
    >Нет участников</span>
    <button
      v-else
      type="button"
      class="flex items-center cursor-pointer border-none bg-transparent p-0 hover:opacity-90 transition-opacity"
      title="Все участники"
      @click.stop="(e) => $emit('view-all', e)"
    >
      <UiAnimatedTooltip :items="tooltipItems" :size="34" ring="var(--island-bg-2)" />
      <span
        v-if="extra > 0"
        class="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 -ml-2"
        style="background: rgba(255,255,255,0.08); color: var(--island-ink-3); box-shadow: 0 0 0 2px var(--island-bg-2);"
      >+{{ extra }}</span>
    </button>
  </div>
</template>
