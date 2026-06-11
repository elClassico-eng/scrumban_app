<script setup lang="ts">
type Person = {
  id: string
  name: string
  color: string
  initials: string
  avatarUrl?: string | null
}

defineProps<{
  people: Person[]
  extra: number
}>()

defineEmits<{
  'view-all': [e: Event]
}>()

const failed = ref(new Set<string>())

function onImgError(id: string) {
  failed.value = new Set(failed.value).add(id)
}

function showImage(p: Person): boolean {
  return !!p.avatarUrl && !failed.value.has(p.id)
}
</script>

<template>
  <div
    class="rounded-2xl p-[13px]"
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
      class="flex items-center -space-x-2 cursor-pointer border-none bg-transparent p-0 hover:opacity-90 transition-opacity"
      title="Все участники"
      @click.stop="(e) => $emit('view-all', e)"
    >
      <span
        v-for="p in people"
        :key="p.id"
        class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
        :title="p.name"
        :style="showImage(p) ? 'box-shadow: 0 0 0 2px var(--island-bg-2);' : `background: ${p.color}; box-shadow: 0 0 0 2px var(--island-bg-2);`"
      >
        <img
          v-if="showImage(p)"
          :src="p.avatarUrl!"
          class="size-full object-cover"
          :alt="p.name"
          @error="onImgError(p.id)"
        >
        <template v-else>{{ p.initials }}</template>
      </span>
      <span
        v-if="extra > 0"
        class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style="background: rgba(255,255,255,0.08); color: var(--island-ink-3); box-shadow: 0 0 0 2px var(--island-bg-2);"
      >+{{ extra }}</span>
    </button>
  </div>
</template>
