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
    <div
      v-else
      class="flex items-center -space-x-2 cursor-pointer"
      role="button"
      title="Все участники"
      @click="(e) => $emit('view-all', e)"
    >
      <span
        v-for="p in people"
        :key="p.id"
        class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden"
        :title="p.name"
        :style="p.avatarUrl ? 'box-shadow: 0 0 0 2px var(--island-bg-2);' : `background: ${p.color}; box-shadow: 0 0 0 2px var(--island-bg-2);`"
      >
        <img
          v-if="p.avatarUrl"
          :src="p.avatarUrl"
          class="size-full object-cover"
          :alt="p.name"
        >
        <template v-else>{{ p.initials }}</template>
      </span>
      <span
        v-if="extra > 0"
        class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style="background: rgba(255,255,255,0.08); color: var(--island-ink-3); box-shadow: 0 0 0 2px var(--island-bg-2);"
      >+{{ extra }}</span>
    </div>
  </div>
</template>
